-- 07_explain_index_usage.sql | run in the mysql CLI; check the `key` column of each EXPLAIN uses the intended index.
USE Industrial_IoT;
-- Active alerts by status/severity            -> idx_alert_status_sev
EXPLAIN SELECT Alert_ID FROM ALERT WHERE Status = 'Open' AND Severity = 'Critical';
-- Alert history of one machine, newest first   -> idx_alert_machine_created
EXPLAIN SELECT Alert_ID FROM ALERT WHERE Machine_ID = 4 ORDER BY Created_At DESC LIMIT 10;
-- Open work orders ordered by due date         -> idx_wo_status_due
EXPLAIN SELECT Work_Order_ID FROM WORK_ORDER WHERE Status = 'Open' ORDER BY Due_Date;
-- A technician's queue                          -> idx_wo_assignee
EXPLAIN SELECT Work_Order_ID FROM WORK_ORDER WHERE Assigned_To_User_ID = 3 AND Status IN ('Open','In Progress');
-- Machines of a plant by status                 -> idx_machine_plant_status
EXPLAIN SELECT Machine_ID FROM MACHINE WHERE Plant_ID = 1 AND Status = 'Warning';
-- Low stock parts                               -> idx_part_stock (reads the index only if selective)
EXPLAIN SELECT Part_ID FROM PART WHERE Quantity_In_Stock <= Reorder_Level;
-- Full-text search                              -> ft_alert_message
EXPLAIN SELECT Alert_ID FROM ALERT WHERE MATCH(Message) AGAINST ('bearing' IN NATURAL LANGUAGE MODE);
-- NOTE: with only a handful of seed rows the optimizer may prefer a table scan; load more rows
-- (e.g. via the Simulator) before drawing conclusions. Every index costs write time and disk, so none were added "just in case".
