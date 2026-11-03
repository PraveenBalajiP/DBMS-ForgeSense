import { q } from '../db/mysql.js';
import { ingestReading } from './ingest.js';

// Generates realistic readings for every active sensor. points = readings per sensor, stepMinutes = spacing.
// If injectMachine is given, sensor #1 of that machine drifts upward past its limit (to trigger alerts).
export async function simulate({ machine_id = null, points = 30, stepMinutes = 2, injectMachine = null } = {}) {
  const sensors = await q(
    `SELECT s.Machine_ID, s.Sensor_No, st.Min_Threshold AS mn, st.Max_Threshold AS mx
       FROM SENSOR s JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID
      WHERE s.Status = 'Active' ${machine_id ? 'AND s.Machine_ID = ?' : ''}`, machine_id ? [machine_id] : []);
  let n = 0, alerts = 0;
  for (const s of sensors) {
    const nominal = s.mn != null && s.mx != null ? (s.mn + s.mx) / 2 : s.mx * 0.62;
    const span = s.mx != null ? s.mx * 0.08 : nominal * 0.08;
    for (let i = points - 1; i >= 0; i--) {
      let v = nominal + (Math.random() - 0.5) * 2 * span;
      if (injectMachine && Number(injectMachine) === s.Machine_ID && s.Sensor_No === 1) {
        const k = points - 1 - i;                                   // 0 .. points-1
        v = nominal + (k / Math.max(points - 1, 1)) * (s.mx * 1.18 - nominal) + (Math.random() - 0.5) * span * 0.3;
      }
      const ts = new Date(Date.now() - i * stepMinutes * 60000);
      const r = await ingestReading({ machine_id: s.Machine_ID, sensor_no: s.Sensor_No, value: Number(v.toFixed(2)), ts });
      n++; if (r.alert?.Is_New) alerts++;
    }
  }
  return { sensors: sensors.length, readings: n, new_alerts: alerts };
}
