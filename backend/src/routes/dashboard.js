import { Router } from 'express';
import { q } from '../db/mysql.js';
import { guard } from '../middleware/auth.js';
import { ah, ALL } from '../utils/http.js';
import { breachesByMachine } from '../services/telemetry.js';
import { computeForecast } from '../services/forecast.js';

const router = Router();

router.get('/', guard(ALL), ah(async (req, res) => {
  const [kpi] = await q(`SELECT
      (SELECT COUNT(*) FROM MACHINE WHERE Status <> 'Decommissioned') AS machines,
      (SELECT COUNT(*) FROM MACHINE WHERE Status IN ('Warning','Faulted')) AS machines_at_risk,
      (SELECT COUNT(*) FROM ALERT WHERE Status <> 'Resolved') AS open_alerts,
      (SELECT COUNT(*) FROM ALERT WHERE Status <> 'Resolved' AND Severity = 'Critical') AS critical_alerts,
      (SELECT COUNT(*) FROM WORK_ORDER WHERE Status IN ('Open','In Progress')) AS open_work_orders,
      (SELECT COUNT(*) FROM v_low_stock_parts) AS low_stock`);
  const bySeverity = await q(`SELECT Severity, COUNT(*) AS n FROM ALERT WHERE Status <> 'Resolved' GROUP BY Severity`);
  const machineStatus = await q('SELECT Status, COUNT(*) AS n FROM MACHINE GROUP BY Status');
  const alertsByDay = await q(`SELECT DATE(Created_At) AS d, COUNT(*) AS n FROM ALERT
      WHERE Created_At >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY DATE(Created_At) ORDER BY d`);
  const topMachines = await q(`SELECT m.Machine_ID, m.Machine_Code, m.Machine_Name, COUNT(*) AS alerts_30d
      FROM ALERT a JOIN MACHINE m ON m.Machine_ID = a.Machine_ID
      WHERE a.Created_At >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY m.Machine_ID, m.Machine_Code, m.Machine_Name HAVING COUNT(*) >= 1 ORDER BY alerts_30d DESC LIMIT 5`);
  const workload = await q(`SELECT u.First_Name AS name, COUNT(w.Work_Order_ID) AS open_orders
      FROM \`USER\` u JOIN ROLE r ON r.Role_ID = u.Role_ID AND r.Role_Name = 'Technician'
      LEFT JOIN WORK_ORDER w ON w.Assigned_To_User_ID = u.User_ID AND w.Status IN ('Open','In Progress')
      WHERE u.Status = 'Active' GROUP BY u.User_ID, u.First_Name`);
  const recent = await q(`SELECT * FROM v_alert_detail WHERE Status <> 'Resolved'
      ORDER BY FIELD(Severity,'Critical','High','Medium','Low'), Created_At DESC LIMIT 6`);

  // MongoDB-backed parts: the dashboard still loads when MongoDB is down
  let breaches = [], forecastTop = [], mongoOnline = true;
  try {
    breaches = await breachesByMachine();
    forecastTop = (await computeForecast(24)).filter((f) => f.forecast?.hours_to_breach != null).slice(0, 4);
  } catch { mongoOnline = false; }
  res.json({ kpi, bySeverity, machineStatus, alertsByDay, topMachines, workload, recent, breaches, forecastTop, mongoOnline });
}));
export default router;
