import { Router } from 'express';
import { q } from '../db/mysql.js';
import { guard } from '../middleware/auth.js';
import { ah, ALL } from '../utils/http.js';

const router = Router();
// small lists used by dropdowns in the UI
router.get('/', guard(ALL), ah(async (req, res) => {
  res.json({
    plants: await q("SELECT Plant_ID, Plant_Name FROM PLANT WHERE Status = 'Active' ORDER BY Plant_Name"),
    sensorTypes: await q('SELECT Sensor_Type_ID, Type_Name, Unit FROM SENSOR_TYPE ORDER BY Type_Name'),
    machines: await q('SELECT Machine_ID, Machine_Code, Machine_Name FROM MACHINE ORDER BY Machine_Code'),
    parts: await q('SELECT Part_ID, Part_Name, Quantity_In_Stock FROM PART ORDER BY Part_Name'),
    staff: await q("SELECT u.User_ID, CONCAT(u.First_Name,' ',u.Last_Name) AS Name, r.Role_Name FROM `USER` u JOIN ROLE r ON r.Role_ID=u.Role_ID WHERE u.Status='Active' AND r.Role_Name IN ('Technician','Engineer') ORDER BY Name"),
    roles: await q('SELECT Role_ID, Role_Name FROM ROLE'),
  });
}));
export default router;
