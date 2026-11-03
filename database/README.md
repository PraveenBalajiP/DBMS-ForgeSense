# Database folder

```
database/
├── mysql/       operational data (users, machines, sensors, alerts, work orders, parts…)
│   ├── 01_schema.sql                  CREATE TABLE (PK, FK, UNIQUE, delete rules)  — never drops anything
│   ├── 02_alter_constraints_indexes.sql   ALTER … ADD CHECK, indexes, FULLTEXT, ALTER/DROP demos (run once)
│   ├── 03_views.sql                   4 views (v_machine_overview, v_alert_detail, v_work_order_detail, v_low_stock_parts)
│   ├── 04_routines_triggers.sql       1 function, 4 stored procedures (transactions), 4 triggers — run with the mysql CLI
│   ├── 05_seed.sql                    demo data (users: Password@123)
│   ├── 06_queries_and_dml.sql         the important queries for the report/viva (JOIN, GROUP BY/HAVING, subquery, window, FULLTEXT, transaction, failing statements)
│   └── 07_explain_index_usage.sql     EXPLAIN statements that show which index each query uses
└── mongodb/     telemetry (one document per sensor reading)
    ├── 01_setup.js                    collection + $jsonSchema validator + compound index + TTL index (safe to re-run)
    ├── 02_aggregation_examples.js     mongosh aggregation examples
    ├── 03_compass_guide.md            what to click and paste in MongoDB Compass
    └── 99_reset_DESTRUCTIVE.js        drops the collection (danger)
```

## Why two databases
* **MySQL** – structured data with relationships and rules: foreign keys, CHECK constraints, triggers, multi-row ACID transactions.
* **MongoDB** – a high-volume, append-only, time-ordered stream of readings that is queried by (machine, sensor, time) and aggregated (hourly average/min/max/σ). Flexible `meta` object, TTL expiry after 90 days.

## Run order (first time)
The easiest way is the npm script, which runs 01 → 05 for you against the database named in `backend/.env`:
```bash
npm run db:setup            # from the repo root; safe, stops if tables already exist
mongosh database/mongodb/01_setup.js
```
Manual alternative: `mysql -u root -p < database/mysql/01_schema.sql` … through `05_seed.sql` (each file begins with `USE Industrial_IoT;`, so the manual path uses that exact database name; the npm script substitutes whatever name you configured).

## Safe vs destructive
| Safe | Destructive (guarded) |
|---|---|
| `npm run db:setup`, `npm run doctor`, `mongo 01_setup.js`, files 03/04 (re-runnable) | `npm run db:reset -- --confirm-destroy`, `mongo 99_reset_DESTRUCTIVE.js`, the `*:test` variants (allowed only on `*_test` databases) |
Files 02 and 05 are not repeatable (adding the same constraint or seed row twice fails); to redo them use the reset.

## Requirements
MySQL 8.0.16+ (CHECK constraints are enforced from that version), MongoDB 5.0+ (`$dateTrunc`, `$setWindowFields`), `mysql` client on PATH, `mongosh` for the .js files.
