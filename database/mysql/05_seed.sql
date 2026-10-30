-- 05_seed.sql  |  demo data. All demo users share the password:  Password@123
USE Industrial_IoT;

INSERT INTO ROLE (Role_Name, Description) VALUES
 ('Admin','Full access, user management, simulator'),
 ('Engineer','Manages machines, alerts, work orders, parts'),
 ('Technician','Works on assigned work orders, uses parts');

INSERT INTO `USER` (Email, Password_Hash, Phone, Status, First_Name, Last_Name, Role_ID) VALUES
 ('admin@iiot.local','$2a$10$3bwknLfMopCv6qFOr7ArN.TJOWdMDLpzZoCGqDtP4nYLUS4AtqG0W','9000000001','Active','Asha','Admin',1),
 ('engineer@iiot.local','$2a$10$3bwknLfMopCv6qFOr7ArN.TJOWdMDLpzZoCGqDtP4nYLUS4AtqG0W','9000000002','Active','Ravi','Engineer',2),
 ('tech1@iiot.local','$2a$10$3bwknLfMopCv6qFOr7ArN.TJOWdMDLpzZoCGqDtP4nYLUS4AtqG0W','9000000003','Active','Tara','Technician',3),
 ('tech2@iiot.local','$2a$10$3bwknLfMopCv6qFOr7ArN.TJOWdMDLpzZoCGqDtP4nYLUS4AtqG0W','9000000004','Active','Vikram','Technician',3),
 ('former@iiot.local','$2a$10$3bwknLfMopCv6qFOr7ArN.TJOWdMDLpzZoCGqDtP4nYLUS4AtqG0W','9000000005','Inactive','Old','Employee',3);

INSERT INTO PLANT (Plant_Name, Location, Status) VALUES
 ('Bengaluru Assembly Plant','Peenya Industrial Area, Bengaluru','Active'),
 ('Madurai Textile Unit','SIDCO Estate, Madurai','Active');

INSERT INTO MACHINE (Machine_Code, Machine_Name, Model, Manufacturer, Installation_Date, Status, Criticality, Plant_ID) VALUES
 ('CNC-001','CNC Milling Machine','VMC-850','Haas','2019-03-15','Operational','High',1),
 ('CMP-001','Air Compressor','GA-37','Atlas Copco','2018-07-01','Operational','High',1),
 ('PMP-001','Coolant Pump','CR-20','Grundfos','2021-01-20','Operational','Medium',1),
 ('LOOM-01','Air-Jet Loom','JAT-910','Toyota','2020-09-10','Operational','High',2),
 ('BLR-001','Steam Boiler','SB-5000','Thermax','2016-11-05','Operational','High',2),
 ('CNV-001','Conveyor Drive','CD-12','Siemens','2022-05-30','Operational','Low',2);

INSERT INTO MACHINE_OPERATING_MODE VALUES
 (1,'Idle'),(1,'Roughing'),(1,'Finishing'),(2,'Loaded'),(2,'Unloaded'),(4,'Standard'),(4,'High Speed');

INSERT INTO SENSOR_TYPE (Type_Name, Unit, Description, Min_Threshold, Max_Threshold) VALUES
 ('Temperature','°C','Bearing / body temperature',NULL,85.00),
 ('Vibration','mm/s','RMS vibration velocity',NULL,7.10),
 ('Pressure','bar','Line pressure',2.00,8.00),
 ('Current','A','Motor current draw',NULL,40.00);

-- 3 sensors per machine: Temperature, Vibration, plus Pressure (machines 2,3,5) or Current (others)
INSERT INTO SENSOR (Machine_ID, Sensor_No, Sensor_Code, Installation_Date, Status, Sensor_Type_ID) VALUES
 (1,1,'CNC-001-T1','2019-03-20','Active',1),(1,2,'CNC-001-V1','2019-03-20','Active',2),(1,3,'CNC-001-C1','2019-03-20','Active',4),
 (2,1,'CMP-001-T1','2018-07-05','Active',1),(2,2,'CMP-001-V1','2018-07-05','Active',2),(2,3,'CMP-001-P1','2018-07-05','Active',3),
 (3,1,'PMP-001-T1','2021-01-25','Active',1),(3,2,'PMP-001-V1','2021-01-25','Active',2),(3,3,'PMP-001-P1','2021-01-25','Active',3),
 (4,1,'LOOM-01-T1','2020-09-15','Active',1),(4,2,'LOOM-01-V1','2020-09-15','Active',2),(4,3,'LOOM-01-C1','2020-09-15','Active',4),
 (5,1,'BLR-001-T1','2016-11-10','Active',1),(5,2,'BLR-001-V1','2016-11-10','Active',2),(5,3,'BLR-001-P1','2016-11-10','Active',3),
 (6,1,'CNV-001-T1','2022-06-05','Active',1),(6,2,'CNV-001-V1','2022-06-05','Active',2),(6,3,'CNV-001-C1','2022-06-05','Active',4);

INSERT INTO PART (Part_Name, Part_Number, Quantity_In_Stock, Reorder_Level, Unit_Cost) VALUES
 ('Ball Bearing 6205','BRG-6205',40,10,250.00),
 ('V-Belt B-52','BLT-B52',25,8,180.00),
 ('Hydraulic Oil 20L','OIL-HYD-20',6,8,3200.00),
 ('Pressure Relief Valve','VLV-PRV-8',12,4,1450.00),
 ('Temperature Probe PT100','PRB-PT100',30,10,620.00),
 ('Coolant Filter','FLT-CLT-01',3,5,540.00);

INSERT INTO ALERT (Machine_ID, Sensor_No, Alert_Type, Severity, Message, Threshold_Value, Actual_Value, Status, Created_At, Resolved_At, Resolved_By) VALUES
 (2,1,'THRESHOLD_HIGH','High','Compressor bearing temperature above limit',85.00,93.40,'Resolved',DATE_SUB(NOW(),INTERVAL 20 DAY),DATE_SUB(NOW(),INTERVAL 19 DAY),2),
 (1,2,'THRESHOLD_HIGH','Medium','CNC spindle vibration above limit',7.10,7.90,'Resolved',DATE_SUB(NOW(),INTERVAL 12 DAY),DATE_SUB(NOW(),INTERVAL 11 DAY),2),
 (5,3,'THRESHOLD_LOW','High','Boiler line pressure dropped below minimum',2.00,1.40,'Resolved',DATE_SUB(NOW(),INTERVAL 6 DAY),DATE_SUB(NOW(),INTERVAL 5 DAY),2),
 (3,1,'THRESHOLD_HIGH','Medium','Coolant pump temperature above limit',85.00,88.10,'Open',DATE_SUB(NOW(),INTERVAL 3 HOUR),NULL,NULL),
 (4,2,'THRESHOLD_HIGH','Critical','Loom vibration critically high, bearing failure likely',7.10,9.80,'Open',DATE_SUB(NOW(),INTERVAL 1 HOUR),NULL,NULL);

UPDATE MACHINE SET Status='Warning' WHERE Machine_ID=3;
UPDATE MACHINE SET Status='Faulted' WHERE Machine_ID=4;

INSERT INTO WORK_ORDER (Priority, Description, Status, Created_At, Due_Date, Completed_At, Machine_ID, Created_By_User_ID, Assigned_To_User_ID, Expected_Hours, Source_Alert_ID) VALUES
 ('High','Replace compressor bearing after high temperature alert','Completed',DATE_SUB(NOW(),INTERVAL 20 DAY),DATE_SUB(NOW(),INTERVAL 18 DAY),DATE_SUB(NOW(),INTERVAL 19 DAY),2,2,3,4.0,1),
 ('Medium','Inspect coolant pump and replace filter','Open',DATE_SUB(NOW(),INTERVAL 2 HOUR),DATE_ADD(NOW(),INTERVAL 2 DAY),NULL,3,2,3,2.5,4),
 ('Critical','Auto-generated: Loom vibration critically high, bearing failure likely','Open',DATE_SUB(NOW(),INTERVAL 1 HOUR),DATE_ADD(NOW(),INTERVAL 1 DAY),NULL,4,1,NULL,NULL,5),
 ('Low','Quarterly lubrication of conveyor drive','Open',NOW(),DATE_ADD(NOW(),INTERVAL 14 DAY),NULL,6,2,4,1.5,NULL);

INSERT INTO WORK_ORDER_PART VALUES (1,1,2),(2,6,1);
INSERT INTO MAINTENANCE_RECORD (Machine_ID, Work_Order_ID, Maintenance_Type, Description, Status, Cost, Scheduled_Date, Completed_Date) VALUES
 (2,1,'Corrective','Replace compressor bearing','Completed',500.00,DATE_SUB(CURDATE(),INTERVAL 18 DAY),DATE_SUB(CURDATE(),INTERVAL 19 DAY)),
 (1,NULL,'Preventive','Spindle lubrication and calibration','Completed',1200.00,DATE_SUB(CURDATE(),INTERVAL 40 DAY),DATE_SUB(CURDATE(),INTERVAL 40 DAY));
