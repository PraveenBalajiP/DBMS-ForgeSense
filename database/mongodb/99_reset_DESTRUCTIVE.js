// DANGER: deletes every sensor reading.   mongosh database/mongodb/99_reset_DESTRUCTIVE.js
// Afterwards run database/mongodb/01_setup.js and `npm run seed:mongo`.
const dbh = db.getSiblingDB(process.env.MONGODB_DB || 'industrial_iot');
print('dropped:', dbh.sensor_readings.drop());
