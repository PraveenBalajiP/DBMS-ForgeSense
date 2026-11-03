# Regression models (predictive maintenance)

## What the model is
**Ordinary least-squares linear regression** on *hourly average* readings of one sensor:

```
value(t) = intercept + slope * t        t = hours since the first hourly bucket
hours_to_breach = (limit - last_value) / slope      (only if the trend moves towards the limit)
```
Outputs per sensor: `slope_per_hour`, `intercept`, `R²`, `RMSE`, `hours_to_breach`, an ETA, a **confidence** (R² and number of points) and a **risk class** (≤ 6 h Critical, ≤ 24 h High, ≤ 72 h Medium, else Low, none if the trend moves away).

It is a deliberately simple trend model. It extrapolates a straight line, so it is only meaningful when R² is high and the degradation is roughly linear. It is **not** deep learning and it has no failure labels, so do not claim "predicted failures" or an accuracy figure: claim "trend-based time-to-limit estimates".

## Two implementations, same maths
| | File | Used for |
|---|---|---|
| Production inference (JavaScript) | `backend/src/ml/regression.js` | live forecasts in the API (`GET /api/ml/forecast`, machine telemetry tab, dashboard) |
| Offline training / evaluation (Python, scikit-learn) | `ml/python/train_regression.py` | report figures, hold-out evaluation, plots, comparison with the JS numbers |

## Run the offline model (never required to run the web app)
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate        macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python ml/python/train_regression.py --plots          # sample CSV in data/sample_input
python ml/python/train_regression.py --source mongo --mongo-db industrial_iot   # live data
```
Outputs go to `ml/artifacts/` (`regression_models.json`, `forecast_summary.csv`, `plots/*.png`); they are git-ignored because they are regenerated.

## How to evaluate it honestly (for the report)
* **In-sample fit:** R² and RMSE per sensor (printed by the script).
* **Hold-out:** the script fits on the first 75 % of hourly points and tests on the last 25 % (chronological, never shuffled). Report that RMSE/MAE, not the in-sample R², as the quality figure.
* **Known limits:** extrapolation beyond the data, non-linear wear, noise spikes, small `n`, no seasonality/operating-mode awareness. State them.
* The JS and Python numbers can differ slightly because Python buckets the sample CSV relative to "now" while MongoDB buckets on clock hours.
