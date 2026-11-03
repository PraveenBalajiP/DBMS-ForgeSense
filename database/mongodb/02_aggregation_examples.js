// mongosh examples for the viva (run after the app/simulator has inserted data)
const c = db.getSiblingDB('industrial_iot').sensor_readings;

// 1. Hourly average / min / max / stddev per sensor (last 24h)
c.aggregate([
  { $match: { machine_id: 1, sensor_no: 1, ts: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } } },
  { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'hour' } },
              avg: { $avg: '$value' }, min: { $min: '$value' }, max: { $max: '$value' },
              sd: { $stdDevPop: '$value' }, n: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

// 2. Latest reading of every sensor of a machine
c.aggregate([
  { $match: { machine_id: 1 } },
  { $sort: { ts: -1 } },
  { $group: { _id: '$sensor_no', type: { $first: '$sensor_type' }, value: { $first: '$value' }, ts: { $first: '$ts' } } },
  { $sort: { _id: 1 } }
]);

// 3. Fleet health: how many readings per machine breached limits in the last 24h
c.aggregate([
  { $match: { status: 'ALERT', ts: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } } },
  { $group: { _id: '$machine_id', breaches: { $sum: 1 }, worst: { $max: '$value' } } },
  { $sort: { breaches: -1 } }
]);

// 4. Moving average (window function, MongoDB 5.0+)
c.aggregate([
  { $match: { machine_id: 1, sensor_no: 1 } },
  { $setWindowFields: { sortBy: { ts: 1 },
      output: { movingAvg: { $avg: '$value', window: { documents: [-4, 0] } } } } },
  { $limit: 20 }
]);
