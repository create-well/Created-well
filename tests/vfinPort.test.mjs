import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const [app, types, permissions, adapter, contracts, shell, decisions, system, fixture, css, readme] = await Promise.all([
  read('src/App.tsx'),
  read('src/types/dashboard.ts'),
  read('src/lib/dashboardPermissions.ts'),
  read('src/vfin/adapter.ts'),
  read('src/vfin/contracts.ts'),
  read('src/vfin/components/VfinViewShell.tsx'),
  read('src/vfin/surfaces/DecisionsSurface.tsx'),
  read('src/vfin/surfaces/SystemSurface.tsx'),
  read('src/vfin/fixtures.ts'),
  read('src/vfin/vfin.css'),
  read('src/vfin/README.md'),
]);

test('the additive VFIN port does not replace the live workflow entrypoint or routes', () => {
  assert.match(app, /<AuthGate/);
  assert.match(app, /useTasksRealtime/);
  assert.match(app, /useRevenueRealtime/);
  assert.match(app, /useWellNotesRealtime/);
  assert.doesNotMatch(app, /from ['"].*\/vfin\//);
  assert.match(readme, /not mounted in `src\/App\.tsx`/);
});

test('VFIN shell maps the complete workflow state contract', () => {
  for (const state of ['loading', 'empty-but-healthy', 'ready', 'stale', 'sync-failed', 'permission-restricted']) {
    assert.match(types, new RegExp(`['"]${state}['"]`));
  }
  for (const label of ['Loading this part of the well', 'Clear for now', 'Retry sync', 'Access restricted', 'Data may be stale']) {
    assert.match(shell, new RegExp(label));
  }
});

test('VFIN adapter retains explicit Source Flow and Care constraints', () => {
  assert.match(adapter, /canStewardSourceFlow\(input\.profile\)/);
  assert.match(adapter, /input\.careConsent === 'granted'/);
  assert.match(adapter, /'permission-restricted'/);
  assert.match(contracts, /sourceFlowState/);
  assert.match(contracts, /careState/);
  for (const steward of ['monny', 'sunshine', 'bingle', 'omar', 'pia']) {
    assert.match(permissions, new RegExp(`['"]${steward}['"]`));
  }
  assert.match(permissions, /trim\(\)\.toLowerCase\(\)/);
});

test('the VFIN Decisions surface retains its reviewed interactions and consent-aware context', () => {
  for (const label of ['+ Add decision', 'Add to queue', 'Decide', 'Defer', 'Nothing needs deciding right now', 'Pia’s Care and Source Flow stewardship remains consent-aware']) {
    assert.ok(decisions.includes(label), `Expected Decisions surface to include: ${label}`);
  }
  assert.match(fixture, /source: 'MOCK'/);
  assert.match(fixture, /pia-care-consent/);
});

test('the VFIN System surface reports only safe operational state', () => {
  for (const label of ['System health', 'Sync state', 'Care boundary', 'Source Flow', 'Router and data boundary', 'Data inventory', 'Operating contract']) {
    assert.match(system, new RegExp(label));
  }
  assert.match(system, /without exposing credentials, raw secrets/);
  assert.match(system, /legacy `\/money` path remains compatible/);
});

test('ported components stay behind the typed payload boundary with scoped styling', () => {
  for (const source of [adapter, contracts, shell, decisions, system, fixture]) {
    assert.doesNotMatch(source, /from ['"][^'"]*(supabase|api|notion)[^'"]*['"]/i);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
  assert.doesNotMatch(css, /(^|\n)(body|html|:root)\b/);
  assert.match(css, /\.vfin-shell/);
  assert.match(readme, /Pure transformation; no service calls/);
});
