-- Run:  mysql -u root -p < sql/01_schema.sql
-- Same entities as your Task 3 DDL, plus: AUTO_INCREMENT keys, SENSOR_TYPE
-- (thresholds), MAINTENANCE_RECORD (with a PK), Resolved_By, Source_Alert_ID.

DROP DATABASE IF EXISTS Industrial_IoT;
CREATE DATABASE Industrial_IoT CHARACTER SET utf8mb4;
USE Industrial_IoT;

CREATE TABLE ROLE (
  Role_ID      INT AUTO_INCREMENT PRIMARY KEY,
  Role_Name    VARCHAR(50)  NOT NULL UNIQUE,
  Description  VARCHAR(255)
);

CREATE TABLE `USER` (
  User_ID        INT AUTO_INCREMENT PRIMARY KEY,
  Email          VARCHAR(100) NOT NULL UNIQUE,
  Password_Hash  VARCHAR(255) NOT NULL,
  Phone          VARCHAR(20),
  Status         VARCHAR(20)  NOT NULL DEFAULT 'Active',
  First_Name     VARCHAR(50)  NOT NULL,
  Last_Name      VARCHAR(50)  NOT NULL,
  Role_ID        INT NOT NULL,
  CONSTRAINT fk_user_role FOREIGN KEY (Role_ID) REFERENCES ROLE(Role_ID)
);

CREATE TABLE PLANT (
  Plant_ID    INT AUTO_INCREMENT PRIMARY KEY,
  Plant_Name  VARCHAR(100) NOT NULL,
  Location    VARCHAR(255),
  Status      VARCHAR(20)  NOT NULL DEFAULT 'Active'
);

CREATE TABLE MACHINE (
  Machine_ID         INT AUTO_INCREMENT PRIMARY KEY,
  Machine_Code       VARCHAR(50)  NOT NULL UNIQUE,
  Machine_Name       VARCHAR(100) NOT NULL,
  Model              VARCHAR(100),
  Manufacturer       VARCHAR(100),
  Installation_Date  DATE,
  Status             VARCHAR(30) NOT NULL DEFAULT 'Operational',
  Criticality        VARCHAR(20) NOT NULL DEFAULT 'Medium',
  Plant_ID           INT NOT NULL,
  CONSTRAINT fk_machine_plant FOREIGN KEY (Plant_ID) REFERENCES PLANT(Plant_ID)
);

-- Multivalued attribute Operating_Mode  ->  its own table
CREATE TABLE MACHINE_OPERATING_MODE (
  Machine_ID     INT NOT NULL,
  Operating_Mode VARCHAR(50) NOT NULL,
  PRIMARY KEY (Machine_ID, Operating_Mode),
  CONSTRAINT fk_mom_machine FOREIGN KEY (Machine_ID) REFERENCES MACHINE(Machine_ID) ON DELETE CASCADE
);

-- Thresholds live here (one rule per kind of sensor)
CREATE TABLE SENSOR_TYPE (
  Sensor_Type_ID INT AUTO_INCREMENT PRIMARY KEY,
  Type_Name      VARCHAR(50) NOT NULL UNIQUE,
  Unit           VARCHAR(20) NOT NULL,
  Description    VARCHAR(255),
  Min_Threshold  DECIMAL(10,2) NULL,
  Max_Threshold  DECIMAL(10,2) NULL
);

-- Weak entity: identified by (Machine_ID, Sensor_No)
CREATE TABLE SENSOR (
  Machine_ID        INT NOT NULL,
  Sensor_No         INT NOT NULL,
  Sensor_Code       VARCHAR(50) NOT NULL,
  Installation_Date DATE,
  Status            VARCHAR(20) NOT NULL DEFAULT 'Active',
  Sensor_Type_ID    INT NOT NULL,
  PRIMARY KEY (Machine_ID, Sensor_No),
  CONSTRAINT fk_sensor_machine FOREIGN KEY (Machine_ID) REFERENCES MACHINE(Machine_ID) ON DELETE CASCADE,
  CONSTRAINT fk_sensor_type    FOREIGN KEY (Sensor_Type_ID) REFERENCES SENSOR_TYPE(Sensor_Type_ID)
);

CREATE TABLE ALERT (
  Alert_ID         INT AUTO_INCREMENT PRIMARY KEY,
  Machine_ID       INT NOT NULL,
  Sensor_No        INT NOT NULL,
  Alert_Type       VARCHAR(50),
  Severity         VARCHAR(20) NOT NULL,
  Message          VARCHAR(500),
  Threshold_Value  DECIMAL(10,2),
  Actual_Value     DECIMAL(10,2),
  Status           VARCHAR(20) NOT NULL DEFAULT 'Open',
  Created_At       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Resolved_At      DATETIME NULL,
  Resolved_By      INT NULL,
  CONSTRAINT fk_alert_sensor FOREIGN KEY (Machine_ID, Sensor_No) REFERENCES SENSOR(Machine_ID, Sensor_No) ON DELETE CASCADE,
  CONSTRAINT fk_alert_user   FOREIGN KEY (Resolved_By) REFERENCES `USER`(User_ID) ON DELETE SET NULL
);

CREATE TABLE WORK_ORDER (
  Work_Order_ID        INT AUTO_INCREMENT PRIMARY KEY,
  Priority             VARCHAR(20)  NOT NULL DEFAULT 'Medium',
  Description          VARCHAR(500) NOT NULL,
  Status               VARCHAR(30)  NOT NULL DEFAULT 'Open',
  Created_At           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Due_Date             DATETIME NULL,
  Completed_At         DATETIME NULL,
  Machine_ID           INT NOT NULL,
  Created_By_User_ID   INT NOT NULL,
  Assigned_To_User_ID  INT NULL,
  Assigned_Date        DATETIME NULL,
  Expected_Hours       DECIMAL(8,2) NULL,
  Assignment_Status    VARCHAR(30) NOT NULL DEFAULT 'Unassigned',
  Source_Alert_ID      INT NULL,
  CONSTRAINT fk_wo_machine  FOREIGN KEY (Machine_ID) REFERENCES MACHINE(Machine_ID),
  CONSTRAINT fk_wo_creator  FOREIGN KEY (Created_By_User_ID)  REFERENCES `USER`(User_ID),
  CONSTRAINT fk_wo_assignee FOREIGN KEY (Assigned_To_User_ID) REFERENCES `USER`(User_ID),
  CONSTRAINT fk_wo_alert    FOREIGN KEY (Source_Alert_ID) REFERENCES ALERT(Alert_ID) ON DELETE SET NULL
);

CREATE TABLE PART (
  Part_ID           INT AUTO_INCREMENT PRIMARY KEY,
  Part_Name         VARCHAR(100) NOT NULL,
  Part_Number       VARCHAR(100) UNIQUE,
  Quantity_In_Stock INT NOT NULL DEFAULT 0,
  Reorder_Level     INT NOT NULL DEFAULT 0,
  Unit_Cost         DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- Resolves the M:N relationship USES
CREATE TABLE WORK_ORDER_PART (
  Work_Order_ID INT NOT NULL,
  Part_ID       INT NOT NULL,
  Quantity_Used INT NOT NULL,
  PRIMARY KEY (Work_Order_ID, Part_ID),
  CONSTRAINT fk_wop_wo   FOREIGN KEY (Work_Order_ID) REFERENCES WORK_ORDER(Work_Order_ID) ON DELETE CASCADE,
  CONSTRAINT fk_wop_part FOREIGN KEY (Part_ID) REFERENCES PART(Part_ID)
);

CREATE TABLE MAINTENANCE_RECORD (
  Maintenance_ID   INT AUTO_INCREMENT PRIMARY KEY,
  Machine_ID       INT NOT NULL,
  Work_Order_ID    INT NULL,
  Maintenance_Type VARCHAR(50) NOT NULL,
  Description      VARCHAR(500),
  Status           VARCHAR(30) NOT NULL DEFAULT 'Completed',
  Cost             DECIMAL(12,2) NOT NULL DEFAULT 0,
  Scheduled_Date   DATE,
  Completed_Date   DATE,
  CONSTRAINT fk_mr_machine FOREIGN KEY (Machine_ID) REFERENCES MACHINE(Machine_ID) ON DELETE CASCADE,
  CONSTRAINT fk_mr_wo      FOREIGN KEY (Work_Order_ID) REFERENCES WORK_ORDER(Work_Order_ID) ON DELETE SET NULL
);