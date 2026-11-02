// npm run load:sample -> pushes data/sample_input/sample_readings.json through the real ingest pipeline
// (MongoDB insert -> threshold check -> MySQL alert). Timestamps are "minutes_ago", so the file works on any day.
import { readFileSync } from 'node:fs';
import { ingestReading } from '../src/services/ingest.js';

const file = new URL('../../data/sample_input/sample_readings.json', import.meta.url);
const { readings } = JSON.parse(readFileSync(file, 'utf8'));
const tally = { OK: 0, WARN: 0, ALERT: 0 }, errors = [];
let newAlerts = 0;
for (const r of readings) {
  try {
    const out = await ingestReading({ machine_id: r.machine_id, sensor_no: r.sensor_no, value: r.value, ts: new Date(Date.now() - r.minutes_ago * 60000) });
    tally[out.status]++; if (out.alert?.Is_New) newAlerts++;
  } catch (e) { errors.push(`${r.machine_id}/${r.sensor_no}: ${e.message}`); }
}
console.log(`Loaded ${readings.length - errors.length}/${readings.length} readings`, tally, `new alerts: ${newAlerts}`);
if (errors.length) console.log('Errors:', errors.slice(0, 5));
process.exit(0);
