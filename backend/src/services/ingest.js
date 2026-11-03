import { q, callProc } from '../db/mysql.js';
import { readings } from '../db/mongo.js';
import { HttpError } from '../utils/http.js';

const severityOf = (ratio) => (ratio >= 0.2 ? 'Critical' : ratio >= 0.1 ? 'High' : 'Medium');

// 1) validate + look up the sensor and its thresholds in MySQL
// 2) store the reading in MongoDB
// 3) if a limit is breached, raise an alert through the stored procedure (one MySQL transaction)
// There is no cross-database transaction: the reading is stored first; if the alert step fails the next breaching reading raises it.
export async function ingestReading(body) {
  const b = body && typeof body === 'object' ? body : {};
  const machine_id = Number(b.machine_id), sensor_no = Number(b.sensor_no), v = Number(b.value);
  if (!Number.isInteger(machine_id) || machine_id < 1 || !Number.isInteger(sensor_no) || sensor_no < 1)
    throw new HttpError(400, 'machine_id and sensor_no must be positive integers');
  if (b.value === null || b.value === '' || typeof b.value === 'boolean' || !Number.isFinite(v) || Math.abs(v) > 1e7)
    throw new HttpError(400, 'value must be a finite number');
  let ts = null;
  if (b.ts !== undefined && b.ts !== null) {
    ts = new Date(b.ts);
    if (Number.isNaN(ts.getTime())) throw new HttpError(400, 'ts must be a valid date');
    if (ts.getTime() > Date.now() + 5 * 60 * 1000) throw new HttpError(400, 'ts cannot be in the future');
  }

  const [s] = await q(
    `SELECT s.Machine_ID, s.Sensor_No, s.Status AS Sensor_Status, st.Type_Name, st.Unit, st.Min_Threshold, st.Max_Threshold, m.Plant_ID
       FROM SENSOR s JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID JOIN MACHINE m ON m.Machine_ID = s.Machine_ID
      WHERE s.Machine_ID = ? AND s.Sensor_No = ?`, [machine_id, sensor_no]);
  if (!s) throw new HttpError(404, 'Unknown machine/sensor');
  if (s.Sensor_Status === 'Inactive') throw new HttpError(409, 'Sensor is inactive; reading rejected');

  const { Min_Threshold: min, Max_Threshold: max } = s;
  let status = 'OK', breach = null;
  if (max != null && v > max) breach = { type: 'THRESHOLD_HIGH', limit: max, ratio: (v - max) / (Math.abs(max) || 1) };
  else if (min != null && v < min) breach = { type: 'THRESHOLD_LOW', limit: min, ratio: (min - v) / (Math.abs(min) || 1) };
  else if (max != null && v > max * 0.9) status = 'WARN';
  else if (min != null && v < min * 1.1) status = 'WARN';
  if (breach) status = 'ALERT';

  const col = await readings();
  await col.insertOne({
    machine_id, sensor_no, sensor_type: s.Type_Name, value: v, unit: s.Unit,
    ts: ts || new Date(), status, meta: { plant_id: s.Plant_ID },
  });

  let alert = null;
  if (breach && (!ts || Date.now() - ts.getTime() < 3600000)) {          // old back-filled readings never raise alerts
    const dir = breach.type === 'THRESHOLD_HIGH' ? 'above' : 'below';
    alert = await callProc('sp_raise_alert', [
      machine_id, sensor_no, breach.type, severityOf(breach.ratio),
      `${s.Type_Name} ${dir} limit: ${v}${s.Unit} vs ${breach.limit}${s.Unit}`, breach.limit, v,
    ]);
  }
  return { status, stored: true, alert };
}
