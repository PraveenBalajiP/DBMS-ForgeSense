# MongoDB Compass — what to click and paste

## Connect
1. Open Compass → **New connection** → URI `mongodb://localhost:27017` → **Connect**.
2. Left panel → database **`industrial_iot`** → collection **`sensor_readings`** (the names come from `MONGODB_DB` in `backend/.env`).

A document looks like:
```json
{ "_id": "…", "machine_id": 4, "sensor_no": 2, "sensor_type": "Vibration", "value": 7.43, "unit": "mm/s",
  "ts": { "$date": "2026-11-02T09:30:00Z" }, "status": "ALERT", "meta": { "plant_id": 2 } }
```
`status` is OK / WARN / ALERT, decided by the backend from the limits stored in MySQL.

## Documents tab — filters (paste into the **Filter** box, press Find)
| Purpose | Filter |
|---|---|
| One sensor | `{ "machine_id": 4, "sensor_no": 2 }` |
| Only threshold breaches | `{ "status": "ALERT" }` |
| Warning zone | `{ "status": "WARN" }` |
| Vibration above its limit | `{ "sensor_type": "Vibration", "value": { "$gt": 7.1 } }` |
| Pressure below its minimum | `{ "sensor_type": "Pressure", "value": { "$lt": 2 } }` |
| Since a moment in time | `{ "ts": { "$gte": new Date("2026-11-02T00:00:00Z") } }` (edit the date) |
| One plant | `{ "meta.plant_id": 2 }` |

Click **Options** → **Sort** `{ "ts": -1 }` (newest first) and **Limit** `20`.
**Live demo trick:** keep this tab open, send a reading from the app (Simulator → "Send ONE reading") and press **Find** again: the new document is at the top.

## Aggregations tab (switch the stage editor to **Text** mode and paste)
**Hourly average / min / max / stddev of one sensor** (what the telemetry chart and the regression model use)
```json
[
  { "$match": { "machine_id": 3, "sensor_no": 1 } },
  { "$group": { "_id": { "$dateTrunc": { "date": "$ts", "unit": "hour" } },
                "avg": { "$avg": "$value" }, "min": { "$min": "$value" }, "max": { "$max": "$value" },
                "sd": { "$stdDevPop": "$value" }, "n": { "$sum": 1 } } },
  { "$sort": { "_id": 1 } }
]
```
**Latest reading of every sensor of a machine**
```json
[
  { "$match": { "machine_id": 4 } }, { "$sort": { "ts": -1 } },
  { "$group": { "_id": "$sensor_no", "type": { "$first": "$sensor_type" }, "value": { "$first": "$value" }, "ts": { "$first": "$ts" } } },
  { "$sort": { "_id": 1 } }
]
```
**Readings per status**
```json
[ { "$group": { "_id": "$status", "n": { "$sum": 1 } } }, { "$sort": { "_id": 1 } } ]
```
**Breaches per machine**
```json
[
  { "$match": { "status": "ALERT" } },
  { "$group": { "_id": "$machine_id", "breaches": { "$sum": 1 }, "worst": { "$max": "$value" } } },
  { "$sort": { "breaches": -1 } }
]
```
**Moving average of the last 5 readings (window function)**
```json
[
  { "$match": { "machine_id": 3, "sensor_no": 1 } },
  { "$setWindowFields": { "sortBy": { "ts": 1 }, "output": { "movingAvg": { "$avg": "$value", "window": { "documents": [-4, 0] } } } } },
  { "$limit": 20 }
]
```

## Other tabs worth showing
* **Schema** → *Analyze Schema*: field types and value ranges (shows that `meta` is flexible).
* **Indexes**: `idx_machine_sensor_ts` (compound `machine_id, sensor_no, ts desc`) and `ttl_ts_90d` (TTL, 7 776 000 s = 90 days). Deletion by TTL is a background task (about once a minute) so it is approximate.
* **Validation**: the `$jsonSchema` rule (status must be OK/WARN/ALERT, required fields…). To demonstrate it, use **Add Data → Insert Document** and try `status: "BAD"`; MongoDB rejects it.
* **Explain Plan** on `{ "machine_id": 4, "sensor_no": 2 }` with sort `{ "ts": -1 }`: look for `IXSCAN` using `idx_machine_sensor_ts` instead of a collection scan.

## Compare with the app
App → **Data explorer → MongoDB telemetry** shows the same documents, indexes, validator and pipeline as Compass, plus the exact filter to paste.
