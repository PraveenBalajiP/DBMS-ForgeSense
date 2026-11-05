-- =====================================================================
-- 04_routines_triggers.sql  |  function, stored procedures (transactions), triggers
-- Run with the mysql CLI (it understands DELIMITER):  mysql -u root -p < database/mysql/04_routines_triggers.sql
-- =====================================================================
USE Industrial_IoT;
DROP FUNCTION  IF EXISTS fn_machine_age_years;
DROP PROCEDURE IF EXISTS sp_raise_alert;
DROP PROCEDURE IF EXISTS sp_use_part;
DROP PROCEDURE IF EXISTS sp_complete_work_order;
DROP PROCEDURE IF EXISTS sp_add_sensor;
DROP TRIGGER   IF EXISTS trg_wo_bi;
DROP TRIGGER   IF EXISTS trg_wo_bu;
DROP TRIGGER   IF EXISTS trg_wo_au;
DROP TRIGGER   IF EXISTS trg_alert_bu;

DELIMITER $$

-- ---------- FUNCTION: derived attribute Machine_Age (years, 1 decimal) ----------
CREATE FUNCTION fn_machine_age_years(p_machine_id INT) RETURNS DECIMAL(5,1)
READS SQL DATA
BEGIN
  DECLARE v_date DATE;
  SELECT Installation_Date INTO v_date FROM MACHINE WHERE Machine_ID = p_machine_id;
  RETURN ROUND(DATEDIFF(CURDATE(), v_date) / 365.25, 1);
END$$

-- ---------- PROCEDURE: raise (or de-duplicate) an alert, escalate, auto work order ----------
CREATE PROCEDURE sp_raise_alert(
  IN p_machine INT, IN p_sensor INT, IN p_type VARCHAR(50), IN p_severity VARCHAR(20),
  IN p_message VARCHAR(500), IN p_threshold DECIMAL(10,2), IN p_actual DECIMAL(10,2))
BEGIN
  DECLARE v_alert INT DEFAULT NULL;
  DECLARE v_new   TINYINT DEFAULT 0;
  DECLARE v_wo    INT DEFAULT NULL;
  DECLARE v_sys   INT DEFAULT NULL;
  DECLARE v_days  INT DEFAULT 3;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- an unresolved alert of the same type on the same sensor is updated, not duplicated
  SELECT Alert_ID INTO v_alert FROM ALERT
   WHERE Machine_ID = p_machine AND Sensor_No = p_sensor AND Alert_Type = p_type AND Status <> 'Resolved'
   ORDER BY Created_At DESC LIMIT 1;

  IF v_alert IS NULL THEN
    INSERT INTO ALERT (Machine_ID, Sensor_No, Alert_Type, Severity, Message, Threshold_Value, Actual_Value, Status)
    VALUES (p_machine, p_sensor, p_type, p_severity, p_message, p_threshold, p_actual, 'Open');
    SET v_alert = LAST_INSERT_ID();
    SET v_new = 1;

    UPDATE MACHINE
       SET Status = CASE WHEN p_severity = 'Critical' THEN 'Faulted'
                         WHEN Status = 'Operational' THEN 'Warning' ELSE Status END
     WHERE Machine_ID = p_machine AND Status NOT IN ('Maintenance','Decommissioned');

    IF p_severity IN ('High','Critical') THEN
      SELECT Work_Order_ID INTO v_wo FROM WORK_ORDER
       WHERE Machine_ID = p_machine AND Status IN ('Open','In Progress') LIMIT 1;
      IF v_wo IS NULL THEN
        SELECT MIN(u.User_ID) INTO v_sys FROM `USER` u JOIN ROLE r ON r.Role_ID = u.Role_ID
         WHERE r.Role_Name = 'Admin' AND u.Status = 'Active';
        IF v_sys IS NOT NULL THEN
          IF p_severity = 'Critical' THEN SET v_days = 1; END IF;
          INSERT INTO WORK_ORDER (Priority, Description, Status, Due_Date, Machine_ID, Created_By_User_ID, Source_Alert_ID)
          VALUES (IF(p_severity = 'Critical','Critical','High'), CONCAT('Auto-generated: ', p_message), 'Open',
                  DATE_ADD(NOW(), INTERVAL v_days DAY), p_machine, v_sys, v_alert);
          SET v_wo = LAST_INSERT_ID();
        END IF;
      END IF;
    END IF;
  ELSE
    UPDATE ALERT SET Actual_Value = p_actual, Message = p_message WHERE Alert_ID = v_alert;
  END IF;

  COMMIT;
  SELECT v_alert AS Alert_ID, v_new AS Is_New, v_wo AS Work_Order_ID;
END$$

-- ---------- PROCEDURE: consume a spare part (row locks + rollback on failure) ----------
CREATE PROCEDURE sp_use_part(IN p_wo INT, IN p_part INT, IN p_qty INT)
BEGIN
  DECLARE v_status VARCHAR(30) DEFAULT NULL;
  DECLARE v_stock  INT DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_qty IS NULL OR p_qty <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be greater than zero';
  END IF;

  START TRANSACTION;
  SELECT Status INTO v_status FROM WORK_ORDER WHERE Work_Order_ID = p_wo FOR UPDATE;
  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Work order not found';
  END IF;
  IF v_status IN ('Completed','Cancelled') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot add parts to a closed work order';
  END IF;

  SELECT Quantity_In_Stock INTO v_stock FROM PART WHERE Part_ID = p_part FOR UPDATE;
  IF v_stock IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Part not found';
  END IF;
  IF v_stock < p_qty THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock for this part';
  END IF;

  INSERT INTO WORK_ORDER_PART (Work_Order_ID, Part_ID, Quantity_Used) VALUES (p_wo, p_part, p_qty)
  ON DUPLICATE KEY UPDATE Quantity_Used = Quantity_Used + p_qty;
  UPDATE PART SET Quantity_In_Stock = Quantity_In_Stock - p_qty WHERE Part_ID = p_part;

  COMMIT;
  SELECT Quantity_In_Stock AS Remaining_Stock FROM PART WHERE Part_ID = p_part;
END$$

-- ---------- PROCEDURE: close a work order atomically ----------
CREATE PROCEDURE sp_complete_work_order(IN p_wo INT, IN p_user INT)
BEGIN
  DECLARE v_machine INT DEFAULT NULL;
  DECLARE v_status  VARCHAR(30) DEFAULT NULL;
  DECLARE v_cost    DECIMAL(12,2) DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT Machine_ID, Status INTO v_machine, v_status FROM WORK_ORDER WHERE Work_Order_ID = p_wo FOR UPDATE;
  IF v_machine IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Work order not found';
  END IF;
  IF v_status IN ('Completed','Cancelled') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Work order is already closed';
  END IF;

  SELECT COALESCE(SUM(wp.Quantity_Used * pt.Unit_Cost), 0) INTO v_cost
    FROM WORK_ORDER_PART wp JOIN PART pt ON pt.Part_ID = wp.Part_ID WHERE wp.Work_Order_ID = p_wo;

  UPDATE WORK_ORDER SET Status = 'Completed' WHERE Work_Order_ID = p_wo;   -- trg_wo_bu stamps Completed_At

  INSERT INTO MAINTENANCE_RECORD (Machine_ID, Work_Order_ID, Maintenance_Type, Description, Status, Cost, Scheduled_Date, Completed_Date)
  SELECT Machine_ID, Work_Order_ID, IF(Source_Alert_ID IS NULL, 'Preventive', 'Corrective'),
         Description, 'Completed', v_cost, DATE(Due_Date), CURDATE()
    FROM WORK_ORDER WHERE Work_Order_ID = p_wo;

  UPDATE ALERT SET Status = 'Resolved', Resolved_By = p_user
   WHERE Machine_ID = v_machine AND Status <> 'Resolved';                  -- trg_alert_bu stamps Resolved_At

  IF NOT EXISTS (SELECT 1 FROM WORK_ORDER WHERE Machine_ID = v_machine AND Status IN ('Open','In Progress')) THEN
    UPDATE MACHINE SET Status = 'Operational'
     WHERE Machine_ID = v_machine AND Status IN ('Warning','Faulted','Maintenance');
  END IF;

  COMMIT;
  SELECT v_cost AS Total_Parts_Cost;
END$$

-- ---------- PROCEDURE: add a sensor to a machine (weak entity partial key = next number) ----------
CREATE PROCEDURE sp_add_sensor(IN p_machine INT, IN p_code VARCHAR(50), IN p_type INT, IN p_install DATE)
BEGIN
  DECLARE v_chk  INT DEFAULT NULL;
  DECLARE v_next INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  SELECT Machine_ID INTO v_chk FROM MACHINE WHERE Machine_ID = p_machine FOR UPDATE;
  IF v_chk IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Machine not found';
  END IF;
  SELECT COALESCE(MAX(Sensor_No), 0) + 1 INTO v_next FROM SENSOR WHERE Machine_ID = p_machine;
  INSERT INTO SENSOR (Machine_ID, Sensor_No, Sensor_Code, Installation_Date, Status, Sensor_Type_ID)
  VALUES (p_machine, v_next, p_code, p_install, 'Active', p_type);
  COMMIT;
  SELECT v_next AS Sensor_No;
END$$

-- ---------- TRIGGERS ----------
CREATE TRIGGER trg_wo_bi BEFORE INSERT ON WORK_ORDER FOR EACH ROW
BEGIN
  IF NEW.Assigned_To_User_ID IS NOT NULL THEN
    IF (SELECT Status FROM `USER` WHERE User_ID = NEW.Assigned_To_User_ID) <> 'Active' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot assign work to an inactive user';
    END IF;
    SET NEW.Assigned_Date = COALESCE(NEW.Assigned_Date, NOW());
    SET NEW.Assignment_Status = 'Assigned';
  END IF;
END$$

CREATE TRIGGER trg_wo_bu BEFORE UPDATE ON WORK_ORDER FOR EACH ROW
BEGIN
  IF NEW.Assigned_To_User_ID IS NOT NULL
     AND (OLD.Assigned_To_User_ID IS NULL OR NEW.Assigned_To_User_ID <> OLD.Assigned_To_User_ID) THEN
    IF (SELECT Status FROM `USER` WHERE User_ID = NEW.Assigned_To_User_ID) <> 'Active' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot assign work to an inactive user';
    END IF;
    SET NEW.Assigned_Date = NOW();
    SET NEW.Assignment_Status = 'Assigned';
  END IF;
  IF NEW.Status = 'Completed' AND OLD.Status <> 'Completed' AND NEW.Completed_At IS NULL THEN
    SET NEW.Completed_At = NOW();
  END IF;
END$$

CREATE TRIGGER trg_wo_au AFTER UPDATE ON WORK_ORDER FOR EACH ROW
BEGIN
  IF NEW.Status = 'In Progress' AND OLD.Status <> 'In Progress' THEN
    UPDATE MACHINE SET Status = 'Maintenance'
     WHERE Machine_ID = NEW.Machine_ID AND Status <> 'Decommissioned';
  END IF;
END$$

CREATE TRIGGER trg_alert_bu BEFORE UPDATE ON ALERT FOR EACH ROW
BEGIN
  IF NEW.Status = 'Resolved' AND OLD.Status <> 'Resolved' AND NEW.Resolved_At IS NULL THEN
    SET NEW.Resolved_At = NOW();
  END IF;
END$$

DELIMITER ;
