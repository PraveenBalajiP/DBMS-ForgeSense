#!/usr/bin/env python3
"""
Offline regression models for predictive maintenance.

What it does (same maths as backend/src/ml/regression.js):
  1. takes sensor readings (sample CSV or live MongoDB) and averages them per hour per sensor
  2. fits an ordinary-least-squares line  value = intercept + slope * hours   (scikit-learn LinearRegression)
  3. reports R^2, RMSE and a chronological hold-out evaluation (fit on the first 75 %, test on the last 25 %)
  4. estimates the hours until the trend reaches the sensor limit and a risk class
  5. writes ml/artifacts/regression_models.json, ml/artifacts/forecast_summary.csv (and PNG plots with --plots)

Usage (from the repository root):
  python ml/python/train_regression.py                       # uses data/sample_input/sample_readings.csv
  python ml/python/train_regression.py --plots               # also saves a chart per sensor
  python ml/python/train_regression.py --source mongo --mongo-uri mongodb://localhost:27017 --mongo-db industrial_iot
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

ROOT = Path(__file__).resolve().parents[2]
# Same limits as the SENSOR_TYPE table in database/mysql/05_seed.sql: (min, max)
LIMITS = {"Temperature": (None, 85.0), "Vibration": (None, 7.1), "Pressure": (2.0, 8.0), "Current": (None, 40.0)}


# ---------------------------------------------------------------- data loading
def load_csv(path: Path) -> pd.DataFrame:
    """CSV columns: machine_id, sensor_no, sensor_type, unit, value, minutes_ago  ->  hourly means."""
    df = pd.read_csv(path)
    df["bucket"] = df["minutes_ago"] // 60                     # 0 = the most recent hour
    hourly = df.groupby(["machine_id", "sensor_no", "sensor_type", "bucket"], as_index=False)["value"].mean()
    now = datetime.now(timezone.utc)
    hourly["hour_ts"] = hourly["bucket"].apply(lambda b: now - timedelta(hours=int(b)))
    return hourly


def load_mongo(uri: str, db: str, hours: int) -> pd.DataFrame:
    """Hourly means straight from MongoDB (needs pymongo and MongoDB >= 5.0 for $dateTrunc)."""
    from pymongo import MongoClient

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    cur = MongoClient(uri)[db]["sensor_readings"].aggregate([
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": {"m": "$machine_id", "s": "$sensor_no", "t": "$sensor_type",
                            "h": {"$dateTrunc": {"date": "$ts", "unit": "hour"}}}, "value": {"$avg": "$value"}}},
    ])
    rows = [{"machine_id": d["_id"]["m"], "sensor_no": d["_id"]["s"], "sensor_type": d["_id"]["t"],
             "hour_ts": d["_id"]["h"], "value": d["value"]} for d in cur]
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- model
def risk_from_hours(h):
    if h is None:
        return "None"
    return "Critical" if h <= 6 else "High" if h <= 24 else "Medium" if h <= 72 else "Low"


def confidence_from(r2, n):
    if n >= 6 and r2 >= 0.8:
        return "High"
    return "Medium" if n >= 4 and r2 >= 0.5 else "Low"


def hours_to_breach(slope, last, lo, hi):
    if hi is not None and slope > 0 and last < hi:
        return (hi - last) / slope
    if lo is not None and slope < 0 and last > lo:
        return (lo - last) / slope
    return None


def holdout(x, y):
    """Chronological 75/25 split. Returns None when there are too few points."""
    n = len(x)
    if n < 8:
        return None
    k = int(n * 0.75)
    m = LinearRegression().fit(x[:k], y[:k])
    pred = m.predict(x[k:])
    return {
        "train_points": int(k), "test_points": int(n - k),
        "rmse": float(np.sqrt(mean_squared_error(y[k:], pred))),
        "mae": float(mean_absolute_error(y[k:], pred)),
        "r2": float(r2_score(y[k:], pred)) if n - k >= 2 else None,
    }


def fit_group(g: pd.DataFrame, lo, hi):
    g = g.sort_values("hour_ts")
    t0 = g["hour_ts"].iloc[0]
    x = np.array([(t - t0).total_seconds() / 3600 for t in g["hour_ts"]]).reshape(-1, 1)
    y = g["value"].to_numpy(dtype=float)
    if len(g) < 4 or np.ptp(x) == 0:
        return None
    model = LinearRegression().fit(x, y)
    pred = model.predict(x)
    slope, intercept = float(model.coef_[0]), float(model.intercept_)
    r2 = float(r2_score(y, pred)) if np.var(y) > 0 else 1.0
    last = float(y[-1])
    h = hours_to_breach(slope, last, lo, hi)
    return {
        "n": int(len(g)), "slope_per_hour": round(slope, 4), "intercept": round(intercept, 4),
        "r2": round(r2, 3), "rmse": round(float(np.sqrt(mean_squared_error(y, pred))), 3),
        "last": round(last, 2),
        "hours_to_breach": None if h is None else round(h, 1),
        "confidence": confidence_from(r2, len(g)), "risk": risk_from_hours(h),
        "holdout": holdout(x, y),
        "_x": x.ravel(), "_y": y, "_pred": pred,
    }


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["csv", "mongo"], default="csv")
    ap.add_argument("--csv", default=str(ROOT / "data" / "sample_input" / "sample_readings.csv"))
    ap.add_argument("--mongo-uri", default="mongodb://localhost:27017")
    ap.add_argument("--mongo-db", default="industrial_iot")
    ap.add_argument("--hours", type=int, default=24)
    ap.add_argument("--out", default=str(ROOT / "ml" / "artifacts"))
    ap.add_argument("--plots", action="store_true", help="save one PNG per sensor")
    a = ap.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    hourly = load_csv(Path(a.csv)) if a.source == "csv" else load_mongo(a.mongo_uri, a.mongo_db, a.hours)
    if hourly.empty:
        raise SystemExit("No readings found. Load data first (npm run load:sample) or check the source.")

    models, summary = [], []
    for (m, s, typ), g in hourly.groupby(["machine_id", "sensor_no", "sensor_type"]):
        lo, hi = LIMITS.get(typ, (None, None))
        r = fit_group(g, lo, hi)
        if r is None:
            continue
        item = {"machine_id": int(m), "sensor_no": int(s), "sensor_type": typ, "min": lo, "max": hi,
                **{k: v for k, v in r.items() if not k.startswith("_")}}
        models.append(item)
        summary.append({k: item[k] for k in ("machine_id", "sensor_no", "sensor_type", "n", "slope_per_hour", "r2", "rmse",
                                              "last", "hours_to_breach", "confidence", "risk")})
        if a.plots:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            (out / "plots").mkdir(exist_ok=True)
            fig, ax = plt.subplots(figsize=(7, 3.4))
            ax.plot(r["_x"], r["_y"], "o-", label="hourly mean")
            ax.plot(r["_x"], r["_pred"], "--", label=f"OLS fit (R2={item['r2']})")
            if hi is not None: ax.axhline(hi, color="red", ls=":", label="max limit")
            if lo is not None: ax.axhline(lo, color="orange", ls=":", label="min limit")
            ax.set_title(f"Machine {m} / sensor {s} ({typ})"); ax.set_xlabel("hours"); ax.legend(fontsize=7)
            fig.tight_layout(); fig.savefig(out / "plots" / f"m{m}_s{s}_{typ}.png", dpi=110); plt.close(fig)

    models.sort(key=lambda d: (d["hours_to_breach"] is None, d["hours_to_breach"] or 0))
    (out / "regression_models.json").write_text(json.dumps(
        {"model": "LinearRegression (OLS) on hourly means", "source": a.source,
         "generated_at": datetime.now(timezone.utc).isoformat(), "models": models}, indent=2), encoding="utf-8")
    df = pd.DataFrame(summary).sort_values("hours_to_breach", na_position="last")
    df.to_csv(out / "forecast_summary.csv", index=False)
    print(df.to_string(index=False))
    print(f"\nWrote {out / 'regression_models.json'} and {out / 'forecast_summary.csv'}")


if __name__ == "__main__":
    main()
