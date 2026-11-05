-- =====================================================================
-- 02_alter_constraints_indexes.sql  |  ALTER / DROP / constraints / indexes
-- Requires MySQL 8.0.16+ (CHECK constraints are enforced from that version)
-- =====================================================================
USE Industrial_IoT;

-- ---------- Database-level validation (CHECK constraints via ALTER) ----------
ALTER TABLE `USER`
  ADD CONSTRAINT chk_user_email  CHECK (Email REGEXP '^[^@ ]+@[^@ ]+\\.[^@ ]+$'),
  ADD CONSTRAINT chk_user_status CHECK (Status IN ('Active','Inactive')),
  ADD CONSTRAINT chk_user_phone  CHECK (Phone IS NULL OR Phone REGEXP '^[0-9+() -]{7,20}$');

ALTER TABLE PLANT   ADD CONSTRAINT chk_plant_status   CHECK (Status IN ('Active','Inactive'));
ALTER TABLE MACHINE
  ADD CONSTRAINT chk_machine_status      CHECK (Status IN ('Operational','Warning','Faulted','Maintenance','Decommissioned')),
  ADD CONSTRAINT chk_machine_criticality CHECK (Criticality IN ('Low','Medium','High'));
ALTER TABLE SENSOR_TYPE
  ADD CONSTRAINT chk_st_thresholds CHECK (Min_Threshold IS NULL OR Max_Threshold IS NULL OR Min_Threshold < Max_Threshold);
ALTER TABLE SENSOR  ADD CONSTRAINT chk_sensor_status  CHECK (Status IN ('Active','Inactive','Faulty'));
ALTER TABLE ALERT
  ADD CONSTRAINT chk_alert_severity CHECK (Severity IN ('Low','Medium','High','Critical')),
  ADD CONSTRAINT chk_alert_status   CHECK (Status IN ('Open','Acknowledged','Resolved')),
  ADD CONSTRAINT chk_alert_resolved CHECK (Resolved_At IS NULL OR Resolved_At >= Created_At);
ALTER TABLE WORK_ORDER
  ADD CONSTRAINT chk_wo_priority CHECK (Priority IN ('Low','Medium','High','Critical')),
  ADD CONSTRAINT chk_wo_status   CHECK (Status IN ('Open','In Progress','Completed','Cancelled')),
  ADD CONSTRAINT chk_wo_assign   CHECK (Assignment_Status IN ('Unassigned','Assigned','Accepted')),
  ADD CONSTRAINT chk_wo_hours    CHECK (Expected_Hours IS NULL OR Expected_Hours > 0),
  ADD CONSTRAINT chk_wo_due      CHECK (Due_Date IS NULL OR Due_Date >= Created_At),
  ADD CONSTRAINT chk_wo_done     CHECK (Completed_At IS NULL OR Completed_At >= Created_At);
ALTER TABLE PART
  ADD CONSTRAINT chk_part_stock   CHECK (Quantity_In_Stock >= 0),
  ADD CONSTRAINT chk_part_reorder CHECK (Reorder_Level >= 0),
  ADD CONSTRAINT chk_part_cost    CHECK (Unit_Cost >= 0);
ALTER TABLE WORK_ORDER_PART ADD CONSTRAINT chk_wop_qty CHECK (Quantity_Used > 0);
ALTER TABLE MAINTENANCE_RECORD
  ADD CONSTRAINT chk_mr_type CHECK (Maintenance_Type IN ('Preventive','Corrective','Predictive')),
  ADD CONSTRAINT chk_mr_cost CHECK (Cost >= 0);

-- ---------- Indexes ----------
CREATE INDEX idx_machine_plant_status  ON MACHINE (Plant_ID, Status);
CREATE INDEX idx_alert_machine_created ON ALERT (Machine_ID, Created_At);
CREATE INDEX idx_alert_status_sev      ON ALERT (Status, Severity);
CREATE INDEX idx_wo_status_due         ON WORK_ORDER (Status, Due_Date);
CREATE INDEX idx_wo_machine            ON WORK_ORDER (Machine_ID);
CREATE INDEX idx_wo_assignee           ON WORK_ORDER (Assigned_To_User_ID, Status);
CREATE INDEX idx_part_stock            ON PART (Quantity_In_Stock, Reorder_Level);

-- ---------- Full-text indexes ----------
ALTER TABLE ALERT      ADD FULLTEXT INDEX ft_alert_message (Message);
ALTER TABLE WORK_ORDER ADD FULLTEXT INDEX ft_wo_description (Description);

-- ---------- ALTER / DROP demonstrations (for the viva) ----------
ALTER TABLE MACHINE ADD COLUMN Last_Serviced_On DATE NULL AFTER Installation_Date;   -- ADD COLUMN
ALTER TABLE MACHINE MODIFY COLUMN Model VARCHAR(150);                                 -- MODIFY COLUMN
ALTER TABLE MACHINE RENAME COLUMN Last_Serviced_On TO Last_Service_Date;              -- RENAME COLUMN
ALTER TABLE MACHINE DROP COLUMN Last_Service_Date;                                    -- DROP COLUMN
DROP INDEX idx_part_stock ON PART;                                                    -- DROP INDEX
CREATE INDEX idx_part_stock ON PART (Quantity_In_Stock, Reorder_Level);
CREATE TABLE SCRATCH_DEMO (id INT PRIMARY KEY, note VARCHAR(20));
DROP TABLE SCRATCH_DEMO;                                                              -- DROP TABLE
