# Industrial IoT Predictive Maintenance & Sensor Alert Engine
DBMS Level 3 project · PES University · Praveen Balaji P (PES2UG24CS374) · Rajgopal Deshpande (PES2UG24CS395)

Machines carry sensors. Every reading is stored in **MongoDB**; a threshold breach raises an alert in **MySQL** through a transactional stored procedure (alert + machine status + auto work order). Engineers assign work, technicians use spare parts and close orders, and a **linear-regression model** estimates *when* a sensor will reach its limit.

## Where everything is
```
.
├── database/            ← ALL SQL and MongoDB scripts
│   ├── mysql/           schema, constraints, views, procedures/triggers, seed, queries, EXPLAIN
│   └── mongodb/         setup (validator + indexes), aggregations, Compass guide
├── backend/             ← Express REST API (port 4000)         package.json, .env.example
│   ├── src/routes/      one file per resource (machines, alerts, work orders, parts, users, ml, explorer, ingest…)
│   ├── src/services/    ingest pipeline, telemetry aggregations, forecast, simulator
│   ├── src/ml/          regression.js  ← the regression model used live
│   ├── scripts/         db setup/reset, doctor, load-sample, seed-mongo
│   └── tests/           unit, database, API, telemetry
├── frontend/            ← Next.js web interface (port 3000)    package.json, .env.example
│   └── src/             app/ (pages), components/ (UI + charts), lib/ (API helper)
├── ml/                  ← offline regression models (Python / scikit-learn)   requirements.txt
├── data/sample_input/   ← sample readings (JSON + CSV) and example requests
├── docs/                ← setup, demo guide, API, git guide, report material
├── scripts/             repo-level pre-push check
├── package.json         repo-level convenience scripts      requirements.txt  (Python deps for ml/)
└── .github/ .githooks/  CI workflow and pre-push hook
```
Read order for a new person: this file → `docs/SETUP_GUIDE.md` → `docs/DEMO_GUIDE.md`.

## Quick start (details in docs/SETUP_GUIDE.md)
Prerequisites: Node 20.6+, MySQL 8.0.16+ (with the `mysql` client on PATH), MongoDB 5+ (+ mongosh), Git.
```bash
npm run install:all                       # installs root, backend and frontend packages
cp backend/.env.example backend/.env      # edit: MySQL password, JWT_SECRET (32+ chars), INGEST_API_KEY
npm run db:setup                          # builds + seeds MySQL (safe: never drops anything)
mongosh database/mongodb/01_setup.js      # MongoDB collection, validator, indexes
npm run load:sample                       # loads data/sample_input/sample_readings.json through the real pipeline
npm run doctor                            # read-only health check
npm run dev                               # API on :4000 + web on :3000 → open http://localhost:3000
```
Demo logins (password `Password@123`, development only): `admin@iiot.local` · `engineer@iiot.local` · `tech1@iiot.local`.

## Commands
| Command (repo root) | What it does |
|---|---|
| `npm run dev` | start backend + frontend together (or `dev:backend` / `dev:frontend`) |
| `npm run db:setup` | first-time MySQL build + seed (safe) |
| `npm run db:reset -- --confirm-destroy` | **drops** and rebuilds the configured database |
| `npm run doctor` | read-only check of env, MySQL objects, MongoDB, indexes |
| `npm run load:sample` / `seed:mongo` | load the sample scenario data / random 24 h history |
| `npm run test:unit` | regression + route-structure tests (no database needed) |
| `npm run verify` | pre-push gate: secrets scan, unit tests, frontend build |
Other test commands (database, API, telemetry) run inside `backend/`: see `docs/SETUP_GUIDE.md` §6.

## Technology
Next.js 15 · Express 4 · MySQL 8 · MongoDB · JWT in an httpOnly cookie + bcrypt · scikit-learn (offline models) · Git/GitHub.

## Honest scope
Telemetry is simulated (no physical sensors). The model is a linear trend estimate, not deep learning; it reports R² and confidence and is only reliable for roughly linear drift. MySQL and MongoDB have no distributed transaction (see `docs/ARCHITECTURE.md`). Details: `docs/KNOWN_LIMITATIONS.md`.
