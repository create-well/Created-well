import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const app = await read('src/App.tsx');
const revenue = await read('src/views/RevenueView.tsx');
const hub = await read('src/views/HubView.tsx');
const dashboardTypes = await read('src/types/dashboard.ts');
const mockDashboard = await read('src/lib/mockDashboard.ts');
const permissions = await read('src/lib/dashboardPermissions.ts');
const syncBar = await read('src/components/SyncStatusBar.tsx');
const viewShell = await read('src/components/ViewShell.tsx');
const main = await read('src/main.tsx');

const routePairs = [
  ['/', 'hub'],
  ['/moves', 'podcast'],
  ['/care', 'coflow'],
  ['/flows', 'workshops'],
  ['/money', 'revenue'],
  ['/decisions', 'well'],
  ['/system', 'team'],
];

test('all seven dashboard routes are declared and mapped to existing views', () => {
  assert.match(main, /BrowserRouter/);
  for (const [path, view] of routePairs) {
    assert.match(app, new RegExp(`['"]${path}['"]\\s*:\\s*['"]${view}['"]`));
    assert.match(app, new RegExp(`\\b${view}:\\s*['"]${path.replace('/', '\\/')}['"]`));
    assert.match(app, new RegExp(`currentView === ['"]${view}['"]`));
  }
});

test('navigation uses the Create Well operating-language order', () => {
  const labels = ['This Week', 'Moves', 'Care', 'FLOWS', 'The Source', 'Decisions', 'System'];
  let previous = -1;
  for (const label of labels) {
    const index = app.indexOf(`label: '${label}'`);
    assert.ok(index > previous, `${label} should follow the previous navigation label`);
    previous = index;
  }
});

test('source-flow lexicon is present in the user-facing resource view', () => {
  assert.match(revenue, /<h1>✦ The Source<\/h1>/);
  assert.match(revenue, /Resource flow held with care, clarity, and shared structure/);
  assert.match(revenue, /\+ Open a channel/);
  assert.match(revenue, /In flow/);
  assert.match(revenue, /Landed/);
  assert.match(revenue, /Open channels/);
  assert.match(hub, /✦ The Source/);
});

test('Pia is included in source-flow stewardship ownership', () => {
  assert.match(revenue, /\['monny', 'sunshine', 'bingle', 'omar', 'pia'\]\.filter\(canStewardSourceFlow\)/);
  assert.match(permissions, /'pia'/);
  assert.match(permissions, /canStewardSourceFlow/);
});

test('typed payload exposes source-flow permission and data contracts', () => {
  assert.match(dashboardTypes, /canViewSourceFlow: boolean/);
  assert.match(dashboardTypes, /sourceFlow: ModuleState/);
  assert.match(dashboardTypes, /sourceFlow: readonly unknown\[\]/);
  assert.match(mockDashboard, /canViewSourceFlow: true/);
  assert.match(mockDashboard, /sourceFlow: 'empty-but-healthy'/);
});

test('shared state components cover the complete module-state contract', () => {
  for (const state of ['loading', 'empty-but-healthy', 'ready', 'stale', 'sync-failed', 'permission-restricted']) {
    assert.match(dashboardTypes, new RegExp(`['"]${state}['"]`));
  }
  assert.match(viewShell, /Loading your dashboard/);
  assert.match(viewShell, /All clear/);
  assert.match(viewShell, /couldn’t refresh/);
  assert.match(viewShell, /Not available yet/);
  assert.match(viewShell, /out of date/);
  assert.match(syncBar, /Last synced/);
  assert.match(syncBar, /Sync failed/);
  assert.match(syncBar, /Showing the latest available data/);
});
