import { Router } from 'express';
import { q, callProc } from '../db/mysql.js';
import { guard } from '../middleware/auth.js';
import { ah, HttpError, intId, ALL, MANAGE } from '../utils/http.js';
import { hourlyStats, recent } from '../services/telemetry.js';
import { forecastBreach } from '../ml/regression.js';

const router = Router();

router.get('/', guard(ALL), ah(async (req, res) => {
  const { plant, status, q: search } = req.query;
  const where = [], args = [];
  if (plant) { where.push('Plant_ID = ?'); args.push(plant); }
  if (status) { where.push('Status = ?'); args.push(status); }
  if (search) { where.push('(Machine_Name LIKE ? OR Machine_Code LIKE ?)'); args.push(`%${search}%`, `%${search}%`); }
  res.json(await q(`SELECT * FROM v_machine_overview ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY Machine_Code`, args));
}));

router.post('/', guard(MANAGE), ah(async (req, res) => {
  const b = req.body || {};
  if (!b.Machine_Code || !b.Machine_Name || !b.Plant_ID) throw new HttpError(400, 'Code, name and plant are required');
  const r = await q(
    'INSERT INTO MACHINE (Machine_Code, Machine_Name, Model, Manufacturer, Installation_Date, Criticality, Plant_ID) VALUES (?,?,?,?,?,?,?)',
    [b.Machine_Code, b.Machine_Name, b.Model || null, b.Manufacturer || null, b.Installation_Date || null, b.Criticality || 'Medium', b.Plant_ID]);
  res.status(201).json({ Machine_ID: r.insertId });
}));

router.get('/:id', guard(ALL), ah(async (req, res) => {
  const id = intId(req.params.id);
  const [m] = await q('SELECT * FROM v_machine_overview WHERE Machine_ID = ?', [id]);
  if (!m) throw new HttpError(404, 'Machine not found');
  const modes = await q('SELECT Operating_Mode FROM MACHINE_OPERATING_MODE WHERE Machine_ID = ?', [id]);
  const sensors = await q(
    `SELECT s.Sensor_No, s.Sensor_Code, s.Status, st.Type_Name, st.Unit, st.Min_Threshold, st.Max_Threshold
       FROM SENSOR s JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID WHERE s.Machine_ID = ? ORDER BY s.Sensor_No`, [id]);
  const alerts = await q('SELECT * FROM v_alert_detail WHERE Machine_ID = ? ORDER BY Created_At DESC LIMIT 10', [id]);
  const workOrders = await q('SELECT * FROM v_work_order_detail WHERE Machine_ID = ? ORDER BY Created_At DESC LIMIT 10', [id]);
  const history = await q('SELECT * FROM MAINTENANCE_RECORD WHERE Machine_ID = ? ORDER BY Completed_Date DESC LIMIT 10', [id]);
  res.json({ machine: m, modes: modes.map((x) => x.Operating_Mode), sensors, alerts, workOrders, history });
}));

router.put('/:id', guard(MANAGE), ah(async (req, res) => {
  const id = intId(req.params.id);
  const b = req.body || {};
  const r = await q('UPDATE MACHINE SET Machine_Name = COALESCE(?, Machine_Name), Status = COALESCE(?, Status), Criticality = COALESCE(?, Criticality) WHERE Machine_ID = ?',
    [b.Machine_Name || null, b.Status || null, b.Criticality || null, id]);
  if (!r.affectedRows) throw new HttpError(404, 'Machine not found');
  res.json({ ok: true });
}));

// Fails with 409 if the machine still has work orders (FK RESTRICT) - intentional integrity demo
router.delete('/:id', guard(['Admin']), ah(async (req, res) => {
  const r = await q('DELETE FROM MACHINE WHERE Machine_ID = ?', [intId(req.params.id)]);
  if (!r.affectedRows) throw new HttpError(404, 'Machine not found');
  res.json({ ok: true });
}));

router.post('/:id/sensors', guard(MANAGE), ah(async (req, res) => {
  const id = intId(req.params.id);
  const b = req.body || {};
  if (!b.Sensor_Code || !b.Sensor_Type_ID) throw new HttpError(400, 'Sensor code and type are required');
  res.status(201).json(await callProc('sp_add_sensor', [id, b.Sensor_Code, b.Sensor_Type_ID, b.Installation_Date || null]));
}));

// MongoDB telemetry for one sensor + the regression forecast
router.get('/:id/readings', guard(ALL), ah(async (req, res) => {
  const id = intId(req.params.id);
  const sensor = Number(req.query.sensor || 1), hours = Math.min(Number(req.query.hours || 24), 24 * 14);
  const [s] = await q(
    `SELECT st.Type_Name, st.Unit, st.Min_Threshold, st.Max_Threshold FROM SENSOR s
       JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID WHERE s.Machine_ID = ? AND s.Sensor_No = ?`, [id, sensor]);
  if (!s) throw new HttpError(404, 'Sensor not found');
  const [raw, hourly] = await Promise.all([recent(id, sensor, 120), hourlyStats(id, sensor, hours)]);
  const forecast = forecastBreach(hourly.map((h) => ({ t: new Date(h._id).getTime(), v: h.avg })), { min: s.Min_Threshold, max: s.Max_Threshold });
  res.json({ sensor: s, raw, hourly, forecast });
}));

export default router;
