USE Industrial_IoT;

-- Machine_Age is the DERIVED attribute from the ER diagram
CREATE OR REPLACE VIEW v_machine_overview AS
        SELECT m.Machine_ID, m.Machine_Code, m.Machine_Name, m.Model, m.Manufacturer,
            m.Installation_Date, m.Status, m.Criticality, m.Plant_ID, p.Plant_Name,
            TIMESTAMPDIFF(YEAR, m.Installation_Date, CURDATE()) AS Machine_Age,
            (SELECT COUNT(*) FROM SENSOR s WHERE s.Machine_ID = m.Machine_ID) AS Sensor_Count,
            (SELECT COUNT(*) FROM ALERT a WHERE a.Machine_ID = m.Machine_ID AND a.Status <> 'Resolved') AS Open_Alerts,
            (SELECT COUNT(*) FROM WORK_ORDER w WHERE w.Machine_ID = m.Machine_ID
                        AND w.Status IN ('Open','In Progress')) AS Open_Work_Orders
        FROM MACHINE m JOIN PLANT p ON p.Plant_ID = m.Plant_ID;

CREATE OR REPLACE VIEW v_alert_detail AS
        SELECT a.Alert_ID, a.Machine_ID, a.Sensor_No, a.Alert_Type, a.Severity, a.Message,
            a.Threshold_Value, a.Actual_Value, a.Status, a.Created_At, a.Resolved_At,
            m.Machine_Code, m.Machine_Name, p.Plant_Name, st.Type_Name, st.Unit
        FROM ALERT a
        JOIN SENSOR s       ON s.Machine_ID = a.Machine_ID AND s.Sensor_No = a.Sensor_No
        JOIN SENSOR_TYPE st ON st.Sensor_Type_ID = s.Sensor_Type_ID
        JOIN MACHINE m      ON m.Machine_ID = a.Machine_ID
        JOIN PLANT p        ON p.Plant_ID = m.Plant_ID;

CREATE OR REPLACE VIEW v_work_order_detail AS
        SELECT w.Work_Order_ID, w.Priority, w.Description, w.Status, w.Created_At, w.Due_Date,
            w.Completed_At, w.Machine_ID, w.Assigned_To_User_ID, w.Assigned_Date,
            w.Expected_Hours, w.Assignment_Status, w.Source_Alert_ID,
            m.Machine_Code, m.Machine_Name,
            CONCAT(c.First_Name, ' ', c.Last_Name) AS Created_By,
            CONCAT(t.First_Name, ' ', t.Last_Name) AS Assigned_To,
            (SELECT COALESCE(SUM(wp.Quantity_Used * pt.Unit_Cost), 0)
                FROM WORK_ORDER_PART wp JOIN PART pt ON pt.Part_ID = wp.Part_ID
                WHERE wp.Work_Order_ID = w.Work_Order_ID) AS Parts_Cost
        FROM WORK_ORDER w
        JOIN MACHINE m ON m.Machine_ID = w.Machine_ID
        JOIN `USER` c  ON c.User_ID = w.Created_By_User_ID
        LEFT JOIN `USER` t ON t.User_ID = w.Assigned_To_User_ID;

CREATE OR REPLACE VIEW v_low_stock_parts AS
    SELECT Part_ID, Part_Name, Part_Number, Quantity_In_Stock, Reorder_Level, Unit_Cost,
        (Reorder_Level - Quantity_In_Stock) AS Shortfall
    FROM PART WHERE Quantity_In_Stock <= Reorder_Level;