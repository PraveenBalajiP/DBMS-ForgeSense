-- 06_queries_and_dml.sql  |  important queries & operations for the demo / report
USE Industrial_IoT;

-- ===== DML =====
INSERT INTO PART (Part_Name, Part_Number, Quantity_In_Stock, Reorder_Level, Unit_Cost) VALUES ('Gasket Set','GSK-100',20,5,95.00);
UPDATE PART SET Quantity_In_Stock = Quantity_In_Stock + 10 WHERE Part_Number = 'GSK-100';
DELETE FROM PART WHERE Part_Number = 'GSK-100';
SELECT * FROM PART ORDER BY Part_Name;

-- ===== JOIN (4 tables): open alerts with machine, plant, sensor type =====
SELECT a.Alert_ID, a.Severity, m.Machine_Name, p.Plant_Name, st.Type_Name, a.Actual_Value, st.Unit, a.Created_At
FROM ALERT a
JOIN SENSOR s ON s.Machine_ID = a.Machine_ID AND s.Sensor_No = a.Sensor_No
JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID
JOIN MACHINE m ON m.Machine_ID = a.Machine_ID
JOIN PLANT p ON p.Plant_ID = m.Plant_ID
WHERE a.Status <> 'Resolved'
ORDER BY FIELD(a.Severity,'Critical','High','Medium','Low'), a.Created_At DESC;

-- ===== GROUP BY + HAVING: machines with 2+ alerts in the last 30 days =====
SELECT m.Machine_Code, COUNT(*) AS Alerts_30d, MAX(a.Actual_Value) AS Peak_Value
FROM ALERT a JOIN MACHINE m ON m.Machine_ID = a.Machine_ID
WHERE a.Created_At >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY m.Machine_ID, m.Machine_Code
HAVING COUNT(*) >= 2
ORDER BY Alerts_30d DESC;

-- ===== Aggregates: mean time to resolve (hours) per severity =====
SELECT Severity, COUNT(*) AS Resolved_Count,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, Created_At, Resolved_At)) / 60, 1) AS Avg_Hours_To_Resolve
FROM ALERT WHERE Status = 'Resolved' GROUP BY Severity;

-- ===== Subquery: machines with no work order in the last 90 days =====
SELECT Machine_Code, Machine_Name FROM MACHINE
WHERE Machine_ID NOT IN (SELECT Machine_ID FROM WORK_ORDER WHERE Created_At >= DATE_SUB(NOW(), INTERVAL 90 DAY));

-- ===== Correlated subquery: parts whose cost used in work orders exceeds the average =====
SELECT p.Part_Name, SUM(wp.Quantity_Used * p.Unit_Cost) AS Total_Spend
FROM WORK_ORDER_PART wp JOIN PART p ON p.Part_ID = wp.Part_ID
GROUP BY p.Part_ID, p.Part_Name
HAVING Total_Spend > (SELECT AVG(x.s) FROM (SELECT SUM(w2.Quantity_Used * p2.Unit_Cost) AS s
                       FROM WORK_ORDER_PART w2 JOIN PART p2 ON p2.Part_ID = w2.Part_ID GROUP BY p2.Part_ID) x);

-- ===== Window function: rank machines by cost of maintenance =====
SELECT Machine_ID, SUM(Cost) AS Total_Cost, RANK() OVER (ORDER BY SUM(Cost) DESC) AS Cost_Rank
FROM MAINTENANCE_RECORD GROUP BY Machine_ID;

-- ===== Technician workload (LEFT JOIN so idle technicians still show) =====
SELECT u.First_Name, COUNT(w.Work_Order_ID) AS Open_Orders, COALESCE(SUM(w.Expected_Hours),0) AS Hours
FROM `USER` u JOIN ROLE r ON r.Role_ID = u.Role_ID AND r.Role_Name = 'Technician'
LEFT JOIN WORK_ORDER w ON w.Assigned_To_User_ID = u.User_ID AND w.Status IN ('Open','In Progress')
GROUP BY u.User_ID, u.First_Name;

-- ===== Full-text search =====
SELECT Alert_ID, Message FROM ALERT WHERE MATCH(Message) AGAINST('bearing temperature' IN NATURAL LANGUAGE MODE);
SELECT Work_Order_ID, Description FROM WORK_ORDER WHERE MATCH(Description) AGAINST('+bearing -conveyor' IN BOOLEAN MODE);

-- ===== Views / function / procedures =====
SELECT * FROM v_machine_overview;
SELECT * FROM v_low_stock_parts;
SELECT Machine_Name, fn_machine_age_years(Machine_ID) AS Age_Years FROM MACHINE;
-- CALL sp_raise_alert(1,1,'THRESHOLD_HIGH','Critical','CNC overheating',85,99.5);
-- CALL sp_use_part(2,1,3);
-- CALL sp_complete_work_order(2,2);

-- ===== Transaction with manual ROLLBACK (integrity demo) =====
START TRANSACTION;
  UPDATE PART SET Quantity_In_Stock = Quantity_In_Stock - 1 WHERE Part_ID = 1;
  SELECT Part_ID, Quantity_In_Stock FROM PART WHERE Part_ID = 1;
ROLLBACK;
SELECT Part_ID, Quantity_In_Stock FROM PART WHERE Part_ID = 1;   -- unchanged

-- ===== Integrity violations (each should FAIL; screenshot the errors) =====
-- INSERT INTO PART (Part_Name, Quantity_In_Stock) VALUES ('Bad', -5);                         -- CHECK
-- INSERT INTO ALERT (Machine_ID,Sensor_No,Severity) VALUES (1,99,'Low');                      -- FK (no such sensor)
-- INSERT INTO `USER` (Email,Password_Hash,First_Name,Last_Name,Role_ID) VALUES ('bad','x','a','b',1); -- CHECK email
-- DELETE FROM MACHINE WHERE Machine_ID = 4;                                                   -- FK RESTRICT (has work orders)
-- UPDATE WORK_ORDER SET Assigned_To_User_ID = 5 WHERE Work_Order_ID = 2;                      -- trigger: inactive user
