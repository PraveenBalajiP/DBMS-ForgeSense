import { Router } from 'express';
import { q } from '../db/mysql.js';
import { mongoDb } from '../db/mongo.js';
import { guard } from '../middleware/auth.js';
import { ah, HttpError, MANAGE } from '../utils/http.js';
import { hourlyPipeline } from '../services/telemetry.js';

// READ-ONLY "show me the data" endpoints for demos. Table names come from a fixed allow-list (never from user text)
// and password hashes are never selected. Restricted to Admin/Engineer.
const router = Router();
const TABLES = ['ROLE', 'USER', 'PLANT', 'MACHINE', 'MACHINE_OPERATING_MODE', 'SENSOR_TYPE', 'SENSOR', 'ALERT', 'WORK_ORDER', 'PART', 'WORK_ORDER_PART', 'MAINTENANCE_RECORD'];
const VIEWS = ['v_machine_overview', 'v_alert_detail', 'v_work_order_detail', 'v_low_stock_parts'];

const QUERIES = [
  { id: 'open-alerts-join', title: 'Open alerts with machine, plant and sensor (4-table JOIN)',
    sql: `SELECT a.Alert_ID, a.Severity, m.Machine_Name, p.Plant_Name, st.Type_Name, a.Actual_Value, st.Unit, a.Created_At
FROM ALERT a
JOIN SENSOR s ON s.Machine_ID = a.Machine_ID AND s.Sensor_No = a.Sensor_No
JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID
JOIN MACHINE m ON m.Machine_ID = a.Machine_ID
JOIN PLANT p ON p.Plant_ID = m.Plant_ID
WHERE a.Status <> 'Resolved'
ORDER BY FIELD(a.Severity,'Critical','High','Medium','Low'), a.Created_At DESC` },
  { id: 'alerts-group-having', title: 'Machines with 1+ alerts in 30 days (GROUP BY / HAVING)',
    sql: `SELECT m.Machine_Code, COUNT(*) AS Alerts_30d, MAX(a.Actual_Value) AS Peak_Value
FROM ALERT a JOIN MACHINE m ON m.Machine_ID = a.Machine_ID
WHERE a.Created_At >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY m.Machine_ID, m.Machine_Code
HAVING COUNT(*) >= 1
ORDER BY Alerts_30d DESC` },
  { id: 'resolve-time', title: 'Average hours to resolve, per severity (aggregates)',
    sql: `SELECT Severity, COUNT(*) AS Resolved_Count,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, Created_At, Resolved_At)) / 60, 1) AS Avg_Hours_To_Resolve
FROM ALERT WHERE Status = 'Resolved' GROUP BY Severity` },
  { id: 'no-recent-wo', title: 'Machines with no work order in 90 days (subquery)',
    sql: `SELECT Machine_Code, Machine_Name FROM MACHINE
WHERE Machine_ID NOT IN (SELECT Machine_ID FROM WORK_ORDER WHERE Created_At >= DATE_SUB(NOW(), INTERVAL 90 DAY))` },
  { id: 'cost-rank', title: 'Maintenance cost ranking (window function RANK)',
    sql: `SELECT Machine_ID, SUM(Cost) AS Total_Cost, RANK() OVER (ORDER BY SUM(Cost) DESC) AS Cost_Rank
FROM MAINTENANCE_RECORD GROUP BY Machine_ID` },
  { id: 'tech-workload', title: 'Technician workload (LEFT JOIN, idle technicians included)',
    sql: `SELECT u.First_Name, COUNT(w.Work_Order_ID) AS Open_Orders, COALESCE(SUM(w.Expected_Hours),0) AS Hours
FROM \`USER\` u JOIN ROLE r ON r.Role_ID = u.Role_ID AND r.Role_Name = 'Technician'
LEFT JOIN WORK_ORDER w ON w.Assigned_To_User_ID = u.User_ID AND w.Status IN ('Open','In Progress')
GROUP BY u.User_ID, u.First_Name` },
  { id: 'fulltext', title: 'Full-text search: alerts mentioning "bearing"',
    sql: `SELECT Alert_ID, Message FROM ALERT WHERE MATCH(Message) AGAINST('bearing' IN NATURAL LANGUAGE MODE)` },
  { id: 'view-overview', title: 'View v_machine_overview (derived Machine_Age)', sql: 'SELECT * FROM v_machine_overview' },
];

router.get('/tables', guard(MANAGE), ah(async (req, res) => {
  const out = [];
  for (const t of [...TABLES, ...VIEWS]) out.push({ name: t, kind: t.startsWith('v_') ? 'view' : 'table', rows: Number((await q(`SELECT COUNT(*) AS n FROM \`${t}\``))[0].n) });
  res.json(out);
}));

router.get('/tables/:name', guard(MANAGE), ah(async (req, res) => {
  const name = [...TABLES, ...VIEWS].find((t) => t === req.params.name);      // allow-list lookup
  if (!name) throw new HttpError(404, 'Unknown table or view');
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const cols = await q(`SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME <> 'Password_Hash' ORDER BY ORDINAL_POSITION`, [name]);
  const list = cols.map((c) => `\`${c.c}\``).join(', ');                       // column names come from the database itself
  const sql = `SELECT ${list} FROM \`${name}\` LIMIT ${limit}`;
  res.json({ name, sql, rows: await q(sql) });
}));

router.get('/queries', guard(MANAGE), (req, res) => res.json(QUERIES));
router.get('/queries/:id', guard(MANAGE), ah(async (req, res) => {
  const item = QUERIES.find((x) => x.id === req.params.id);
  if (!item) throw new HttpError(404, 'Unknown saved query');
  res.json({ ...item, rows: await q(item.sql) });
}));

router.get('/mongo/overview', guard(MANAGE), ah(async (req, res) => {
  const db = await mongoDb();
  const col = db.collection('sensor_readings');
  const info = (await db.listCollections({ name: 'sensor_readings' }).toArray())[0];
  res.json({
    database: process.env.MONGODB_DB, collection: 'sensor_readings',
    count: await col.estimatedDocumentCount(),
    indexes: (await col.indexes().catch(() => [])).map((i) => ({ name: i.name, key: i.key, expireAfterSeconds: i.expireAfterSeconds })),
    validator: info?.options?.validator || null,
    byStatus: await col.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
    byMachine: await col.aggregate([{ $group: { _id: '$machine_id', n: { $sum: 1 }, last: { $max: '$ts' } } }, { $sort: { _id: 1 } }]).toArray(),
  });
}));

router.get('/mongo/documents', guard(MANAGE), ah(async (req, res) => {
  const filter = {};
  if (req.query.machine) filter.machine_id = Number(req.query.machine);
  if (req.query.sensor) filter.sensor_no = Number(req.query.sensor);
  if (['OK', 'WARN', 'ALERT'].includes(req.query.status)) filter.status = req.query.status;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const docs = await (await mongoDb()).collection('sensor_readings').find(filter).sort({ ts: -1 }).limit(limit).toArray();
  res.json({ filter, sort: { ts: -1 }, limit, docs: docs.map((d) => ({ ...d, _id: String(d._id) })) });
}));

router.get('/mongo/pipeline', guard(MANAGE), ah(async (req, res) => {
  const machine = Number(req.query.machine || 1), sensor = Number(req.query.sensor || 1);
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const pipeline = hourlyPipeline(machine, sensor, since);
  res.json({ pipeline, result: await (await mongoDb()).collection('sensor_readings').aggregate(pipeline).toArray() });
}));

export default router;
