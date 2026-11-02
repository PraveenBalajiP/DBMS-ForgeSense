// =====================================================================
// Regression model used for predictive maintenance (inference side).
// Ordinary least squares (OLS) on HOURLY AVERAGES of one sensor:   value = intercept + slope * hours
// Then: hours until the fitted trend reaches the sensor's limit.
// The same maths is implemented offline with scikit-learn in ml/python/train_regression.py (they must agree).
// This is a simple linear trend model, not deep learning: it extrapolates and is only trustworthy when R² is high.
// =====================================================================

/** Fit y = a + b x by least squares. points: [{x, y}]. Returns null when impossible (n < 2 or no x variance). */
export function fitLinear(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
  if (sxx === 0) return null;
  const slope = sxy / sxx, intercept = my - slope * mx;
  const sse = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = syy === 0 ? 1 : 1 - sse / syy;       // a perfectly flat series is "perfectly explained"
  return { slope, intercept, r2, rmse: Math.sqrt(sse / n), n };
}

export const riskFromHours = (h) => (h == null ? 'None' : h <= 6 ? 'Critical' : h <= 24 ? 'High' : h <= 72 ? 'Medium' : 'Low');
export const confidenceFrom = (r2, n) => (n >= 6 && r2 >= 0.8 ? 'High' : n >= 4 && r2 >= 0.5 ? 'Medium' : 'Low');

const round = (v, d) => (v == null ? null : Number(v.toFixed(d)));

/**
 * series: [{ t: epoch ms, v: number }] sorted by time (hourly averages)
 * limits: { min, max } (either may be null)
 * Returns null when there is not enough data (fewer than 4 points).
 */
export function forecastBreach(series, { min = null, max = null } = {}) {
  if (!series || series.length < 4) return null;
  const t0 = series[0].t;
  const pts = series.map((p) => ({ x: (p.t - t0) / 3600000, y: p.v }));
  const fit = fitLinear(pts);
  if (!fit) return null;

  const last = pts[pts.length - 1].y, lastT = series[series.length - 1].t;
  let hours = null;
  if (max != null && fit.slope > 0 && last < max) hours = (max - last) / fit.slope;
  if (min != null && fit.slope < 0 && last > min) hours = (min - last) / fit.slope;

  return {
    model: 'linear-regression (OLS) on hourly averages',
    n: fit.n,
    slope_per_hour: round(fit.slope, 4),
    intercept: round(fit.intercept, 4),
    r2: round(fit.r2, 3),
    rmse: round(fit.rmse, 3),
    last: round(last, 2),
    hours_to_breach: round(hours, 1),
    eta: hours == null ? null : new Date(lastT + hours * 3600000).toISOString(),
    confidence: confidenceFrom(fit.r2, fit.n),
    risk: riskFromHours(hours),
    fitted: pts.map((p, i) => ({ t: series[i].t, v: round(fit.intercept + fit.slope * p.x, 3) })),   // the regression line, for charts
  };
}
