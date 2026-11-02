import { MongoClient } from 'mongodb';
import { requireMongoEnv } from '../config/env.js';

const g = globalThis;
function connect() {
  if (!g.__mongoP) {
    requireMongoEnv();
    const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    g.__mongoP = c.connect().catch((e) => { g.__mongoP = null; throw e; });   // retry on the next request if it failed
  }
  return g.__mongoP;
}

export async function mongoDb() {
  return (await connect()).db(process.env.MONGODB_DB);
}
export async function closeMongo() {
  if (g.__mongoP) { const c = await g.__mongoP; g.__mongoP = null; await c.close(); }
}

// Collection of sensor readings (one document per reading). Indexes are created on first use if missing.
export async function readings() {
  const col = (await mongoDb()).collection('sensor_readings');
  if (!g.__mongoIdx) {
    await col.createIndex({ machine_id: 1, sensor_no: 1, ts: -1 }, { name: 'idx_machine_sensor_ts' });
    await col.createIndex({ ts: 1 }, { name: 'ttl_ts_90d', expireAfterSeconds: 60 * 60 * 24 * 90 });
    g.__mongoIdx = true;
  }
  return col;
}
