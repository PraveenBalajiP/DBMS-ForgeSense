import { q } from '../db/mysql.js';
import { hourlyAll } from './telemetry.js';
import { forecastBreach } from '../ml/regression.js';

// Runs the regression model for every active sensor (hourly averages of the last `hours` hours).
// Sorted: soonest predicted breach first, sensors with no predicted breach last.
export async function computeForecast(hours = 24) {
  const [rows, sensors] = await Promise.all([
    hourlyAll(hours),
    q(`SELECT s.Machine_ID, s.Sensor_No, s.Sensor_Code, m.Machine_Code, m.Machine_Name, st.Type_Name, st.Unit, st.Min_Threshold, st.Max_Threshold
         FROM SENSOR s JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID JOIN MACHINE m ON m.Machine_ID = s.Machine_ID
        WHERE s.Status = 'Active' AND m.Status <> 'Decommissioned'`),
  ]);
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r._id.m}:${r._id.s}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push({ t: new Date(r._id.h).getTime(), v: r.avg });
  }
  const out = [];
  for (const s of sensors) {
    const series = (byKey.get(`${s.Machine_ID}:${s.Sensor_No}`) || []).sort((a, b) => a.t - b.t);
    const f = forecastBreach(series, { min: s.Min_Threshold, max: s.Max_Threshold });
    out.push({
      machine_id: s.Machine_ID, machine_code: s.Machine_Code, machine_name: s.Machine_Name, sensor_no: s.Sensor_No,
      sensor_type: s.Type_Name, unit: s.Unit, min: s.Min_Threshold, max: s.Max_Threshold,
      points: series.length, spark: series.map((p) => Number(p.v.toFixed(2))),
      forecast: f ? { ...f, fitted: undefined } : null,
    });
  }
  const rank = (x) => (x.forecast?.hours_to_breach == null ? Infinity : x.forecast.hours_to_breach);
  return out.sort((a, b) => rank(a) - rank(b));
}
