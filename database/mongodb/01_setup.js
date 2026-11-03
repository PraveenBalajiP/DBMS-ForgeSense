// mongosh "mongodb://localhost:27017" database/mongodb/01_setup.js
// NON-destructive and safe to re-run: creates the collection/indexes only if they are missing.
// To wipe the collection use database/mongodb/99_reset_DESTRUCTIVE.js.
const dbh = db.getSiblingDB(process.env.MONGODB_DB || 'industrial_iot');
if (!dbh.getCollectionNames().includes('sensor_readings')) {
  dbh.createCollection('sensor_readings', {
    validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['machine_id', 'sensor_no', 'sensor_type', 'value', 'unit', 'ts', 'status'],
      properties: {
        machine_id:  { bsonType: ['int', 'long', 'double'] },
        sensor_no:   { bsonType: ['int', 'long', 'double'] },
        sensor_type: { bsonType: 'string' },
        value:       { bsonType: ['double', 'int', 'long', 'decimal'] },
        unit:        { bsonType: 'string' },
        ts:          { bsonType: 'date' },
        status:      { enum: ['OK', 'WARN', 'ALERT'] },
        meta:        { bsonType: 'object' }
      } } },
    validationLevel: 'strict'
  });
  print('created collection sensor_readings');
}
// Compound index: serves "latest N readings of sensor X on machine Y" and time-range scans
dbh.sensor_readings.createIndex({ machine_id: 1, sensor_no: 1, ts: -1 }, { name: 'idx_machine_sensor_ts' });
// TTL index: raw readings expire ~90 days after `ts`. Deletion is done by a background task that runs about
// once a minute, so removal is approximate, not exact-to-the-second.
dbh.sensor_readings.createIndex({ ts: 1 }, { name: 'ttl_ts_90d', expireAfterSeconds: 60 * 60 * 24 * 90 });
print('indexes:', JSON.stringify(dbh.sensor_readings.getIndexes().map((i) => i.name)));
