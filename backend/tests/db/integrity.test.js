// Needs the dedicated test DB:  npm run db:reset:test   then   npm run test:db
import '../helpers/guard.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { endPool, q, callProc } from '../../src/db/mysql.js';

after(() => endPool());
const rejects = (sql, params, re) => assert.rejects(() => q(sql, params), re);

test('CHECK: negative stock is rejected', () =>
  rejects('INSERT INTO PART (Part_Name, Quantity_In_Stock) VALUES (?, ?)', ['Bad', -5], /chk_part_stock/));
test('CHECK: malformed e-mail is rejected', () =>
  rejects('INSERT INTO `USER` (Email, Password_Hash, First_Name, Last_Name, Role_ID) VALUES (?,?,?,?,?)', ['bad', 'x', 'a', 'b', 1], /chk_user_email/));
test('CHECK: invalid severity is rejected', () =>
  rejects("INSERT INTO ALERT (Machine_ID, Sensor_No, Severity) VALUES (1, 1, 'Extreme')", [], /chk_alert_severity/));
test('FK: alert for a non-existent sensor is rejected', () =>
  rejects("INSERT INTO ALERT (Machine_ID, Sensor_No, Severity) VALUES (1, 99, 'Low')", [], /foreign key/i));
test('FK RESTRICT: machine with work orders cannot be deleted', () =>
  rejects('DELETE FROM MACHINE WHERE Machine_ID = 4', [], /foreign key/i));
test('UNIQUE: duplicate machine code is rejected', () =>
  rejects("INSERT INTO MACHINE (Machine_Code, Machine_Name, Plant_ID) VALUES ('CNC-001','dup',1)", [], /Duplicate entry/));
test('TRIGGER: cannot assign work to an inactive user', () =>
  rejects('UPDATE WORK_ORDER SET Assigned_To_User_ID = 5 WHERE Work_Order_ID = 3', [], /inactive user/));

test('TRANSACTION: insufficient stock fails and stock is unchanged', async () => {
  const [{ s: before }] = await q('SELECT Quantity_In_Stock AS s FROM PART WHERE Part_ID = 1');
  await assert.rejects(() => callProc('sp_use_part', [2, 1, 99999]), /Insufficient stock/);
  const [{ s: after_ }] = await q('SELECT Quantity_In_Stock AS s FROM PART WHERE Part_ID = 1');
  assert.equal(after_, before);
});
test('PROCEDURE: quantity must be positive', () =>
  assert.rejects(() => callProc('sp_use_part', [2, 1, 0]), /greater than zero/));

test('FUNCTION + VIEW: derived Machine_Age is consistent', async () => {
  const [{ a }] = await q('SELECT fn_machine_age_years(1) AS a');
  const [{ Machine_Age }] = await q('SELECT Machine_Age FROM v_machine_overview WHERE Machine_ID = 1');
  assert.ok(a > 5);
  assert.ok(Math.abs(a - Machine_Age) <= 1);
});
test('VIEW: low-stock view lists parts at/below reorder level', async () => {
  const rows = await q('SELECT * FROM v_low_stock_parts');
  assert.ok(rows.length >= 1 && rows.every((r) => r.Quantity_In_Stock <= r.Reorder_Level));
});
test('FULLTEXT: search finds "bearing" alerts', async () => {
  const rows = await q("SELECT Alert_ID FROM ALERT WHERE MATCH(Message) AGAINST ('bearing' IN NATURAL LANGUAGE MODE)");
  assert.ok(rows.length >= 1);
});

test('sp_raise_alert: creates alert + auto work order, then de-duplicates', async () => {
  const args = [6, 2, 'THRESHOLD_HIGH', 'Critical', 'TEST vibration critical', 7.1, 9.9];
  const first = await callProc('sp_raise_alert', args);
  try {
    assert.equal(Number(first.Is_New), 1);
    assert.ok(first.Work_Order_ID, 'critical alert should auto-create a work order');
    const [m] = await q('SELECT Status FROM MACHINE WHERE Machine_ID = 6');
    assert.equal(m.Status, 'Faulted');
    const second = await callProc('sp_raise_alert', args);
    assert.equal(Number(second.Is_New), 0);
    assert.equal(second.Alert_ID, first.Alert_ID);
  } finally {                                             // clean up so the seed data stays usable
    await q('DELETE FROM WORK_ORDER WHERE Source_Alert_ID = ?', [first.Alert_ID]);
    await q('DELETE FROM ALERT WHERE Alert_ID = ?', [first.Alert_ID]);
    await q("UPDATE MACHINE SET Status = 'Operational' WHERE Machine_ID = 6");
  }
});
