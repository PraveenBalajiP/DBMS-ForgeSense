# Sample inputs

| File | Use |
|---|---|
| `sample_readings.json` | 864 readings (24 h x 18 sensors). Loaded by `npm run load:sample`. Each row: `machine_id, sensor_no, sensor_type, unit, value, minutes_ago` |
| `sample_readings.csv` | the same data as CSV. Read by the Python regression models (`ml/python/train_regression.py`) |
| `single_reading.json` | one normal reading |
| `breach_reading.json` | one reading above the 85 C limit (raises an alert) |

Sensor limits come from the `SENSOR_TYPE` table: Temperature max 85 C, Vibration max 7.1 mm/s, Pressure 2 to 8 bar, Current max 40 A.
Scenarios hidden in the sample data: machine 3 temperature climbing towards 85 C (good for the regression forecast), machine 4 vibration crossing 7.1 mm/s, machine 2 pressure falling towards 2 bar, machine 5 temperature in the WARN zone, everything else stable.

## Load the sample data (backend folder, MongoDB + MySQL running)
```bash
npm run load:sample
```

## Send ONE reading to the device endpoint
`INGEST_API_KEY` is the value in `backend/.env`. The backend listens on port 4000.

**macOS / Linux / Git Bash**
```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "x-api-key: YOUR_INGEST_API_KEY" -H "Content-Type: application/json" \
  -d @data/sample_input/single_reading.json
```
**Windows PowerShell**
```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/ingest `
  -Headers @{ "x-api-key" = "YOUR_INGEST_API_KEY" } -ContentType "application/json" `
  -Body (Get-Content data/sample_input/breach_reading.json -Raw)
```
Response shape (HTTP 201): `{ "status": "OK" | "WARN" | "ALERT", "stored": true, "alert": null | { "Alert_ID": n, "Is_New": 0|1, "Work_Order_ID": n|null } }`

Possible errors: 400 invalid payload, 401 wrong key, 404 unknown sensor, 409 inactive sensor, 503 database offline.
