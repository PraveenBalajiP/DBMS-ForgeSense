import { readings } from '../db/mongo.js';

// MongoDB aggregation: hourly avg/min/max/stddev for ONE sensor
export async function hourlyStats(machine_id, sensor_no, hours = 24) {
  const col = await readings();
  const since = new Date(Date.now() - hours * 3600 * 1000);
  return col.aggregate(hourlyPipeline(machine_id, sensor_no, since)).toArray();
}
export const hourlyPipeline = (machine_id, sensor_no, since) => [
  { $match: { machine_id: Number(machine_id), sensor_no: Number(sensor_no), ts: { $gte: since } } },
  { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'hour' } }, avg: { $avg: '$value' }, min: { $min: '$value' },
              max: { $max: '$value' }, sd: { $stdDevPop: '$value' }, n: { $sum: 1 } } },
  { $sort: { _id: 1 } },
];

// hourly averages for EVERY sensor in one aggregation (used by the fleet forecast)
export async function hourlyAll(hours = 24) {
  const col = await readings();
  const since = new Date(Date.now() - hours * 3600 * 1000);
  return col.aggregate([
    { $match: { ts: { $gte: since } } },
    { $group: { _id: { m: '$machine_id', s: '$sensor_no', h: { $dateTrunc: { date: '$ts', unit: 'hour' } } }, avg: { $avg: '$value' } } },
    { $sort: { '_id.h': 1 } },
  ]).toArray();
}

// latest raw readings (served by the compound index)
export async function recent(machine_id, sensor_no, limit = 60) {
  const col = await readings();
  const rows = await col.find({ machine_id: Number(machine_id), sensor_no: Number(sensor_no) },
    { projection: { _id: 0, value: 1, ts: 1, status: 1 } }).sort({ ts: -1 }).limit(limit).toArray();
  return rows.reverse();
}

// fleet-wide: threshold breaches per machine in the last 24h
export async function breachesByMachine() {
  const col = await readings();
  return col.aggregate([
    { $match: { status: 'ALERT', ts: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } } },
    { $group: { _id: '$machine_id', breaches: { $sum: 1 }, worst: { $max: '$value' } } },
    { $sort: { breaches: -1 } },
  ]).toArray();
}
