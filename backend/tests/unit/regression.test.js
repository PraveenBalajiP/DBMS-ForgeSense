import test from 'node:test';
import assert from 'node:assert/strict';
import { fitLinear, forecastBreach, riskFromHours, confidenceFrom } from '../../src/ml/regression.js';

const hourly = (vals) => vals.map((v, i) => ({ t: i * 3600000, v }));

test('fitLinear recovers slope/intercept of an exact line with R2 = 1', () => {
  const f = fitLinear([0, 1, 2, 3, 4].map((x) => ({ x, y: 5 + 2 * x })));
  assert.ok(Math.abs(f.slope - 2) < 1e-9 && Math.abs(f.intercept - 5) < 1e-9 && Math.abs(f.r2 - 1) < 1e-9);
});
test('fitLinear: fewer than 2 points or no x variance -> null', () => {
  assert.equal(fitLinear([{ x: 1, y: 1 }]), null);
  assert.equal(fitLinear([{ x: 1, y: 1 }, { x: 1, y: 2 }]), null);
});
test('rising trend predicts hours to the max limit', () => {
  const r = forecastBreach(hourly([60, 63, 66, 69, 72, 75, 78, 81]), { min: null, max: 85 });
  assert.equal(r.slope_per_hour, 3);
  assert.equal(r.hours_to_breach, 1.3);
  assert.equal(r.r2, 1);
  assert.equal(r.risk, 'Critical');
  assert.equal(r.confidence, 'High');
  assert.equal(r.fitted.length, 8);
});
test('falling trend predicts hours to the min limit', () => {
  const r = forecastBreach(hourly([8, 7.5, 7, 6.5, 6, 5.5]), { min: 2, max: 10 });
  assert.equal(r.hours_to_breach, 7);
});
test('flat series -> no breach predicted, risk None', () => {
  const r = forecastBreach(hourly([50, 50, 50, 50, 50]), { min: null, max: 85 });
  assert.equal(r.hours_to_breach, null);
  assert.equal(r.risk, 'None');
});
test('moving away from the limit -> no breach predicted', () => {
  assert.equal(forecastBreach(hourly([80, 78, 76, 74, 72]), { max: 85 }).hours_to_breach, null);
});
test('fewer than 4 points -> null (not enough data)', () => assert.equal(forecastBreach(hourly([1, 2, 3]), { max: 10 }), null));
test('risk and confidence classes', () => {
  assert.deepEqual([riskFromHours(3), riskFromHours(20), riskFromHours(50), riskFromHours(200), riskFromHours(null)], ['Critical', 'High', 'Medium', 'Low', 'None']);
  assert.equal(confidenceFrom(0.95, 10), 'High');
  assert.equal(confidenceFrom(0.6, 5), 'Medium');
  assert.equal(confidenceFrom(0.2, 20), 'Low');
});
