import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDashboardConfiguration } from '../api/_dashboard-config.ts';
import { displayedDashboardStatus, DASHBOARD_STALE_AFTER_MS } from '../src/lib/dashboardStatus.ts';
const required = ['NOTION_SECRET', 'NOTION_DB_MOVES', 'NOTION_DB_PEOPLE', 'NOTION_DB_FLOWS', 'NOTION_DB_CONTENT', 'NOTION_DB_MONEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const configured = Object.fromEntries(required.map(key => [key, 'synthetic-config-value']));
test('all required source settings present', () => assert.equal(hasDashboardConfiguration(configured), true));
for (const key of required) {
  test(`missing or blank ${key} cannot be a successful empty dashboard`, () => {
    for (const value of [undefined, '', '  ']) assert.equal(hasDashboardConfiguration({ ...configured, [key]: value }), false);
  });
}
for (const status of ['loading', 'stale', 'failed']) test(`${status} must not be promoted to fresh`, () => {
  assert.equal(displayedDashboardStatus(status, new Date(1000), 1000), status);
  assert.equal(displayedDashboardStatus(status, null, 1000), status);
});
test('recent complete fetch is transport-fresh', () => assert.equal(displayedDashboardStatus('fresh', new Date(1000), 1001), 'fresh'));
test('missing, invalid, or future fetch time is not fresh', () => {
  for (const date of [null, new Date(NaN), new Date(1001)]) assert.equal(displayedDashboardStatus('fresh', date, 1000), 'stale');
});
test('five-minute boundary ages to stale', () => {
  assert.equal(displayedDashboardStatus('fresh', new Date(1000), 1000 + DASHBOARD_STALE_AFTER_MS - 1), 'fresh');
  assert.equal(displayedDashboardStatus('fresh', new Date(1000), 1000 + DASHBOARD_STALE_AFTER_MS), 'stale');
});
