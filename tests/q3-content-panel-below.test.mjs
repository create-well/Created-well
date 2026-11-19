// Audit-6 Q3 (ruling, register 1506): the "Content and linked Flows" panel
// placement pin read MovesPage.tsx, the panel's only render site. MovesPage
// is deleted in the ghost cleanup (packet CC), so the placement legs retire
// with it. What survives here: the panel component's own shape — a
// collapsed-by-default details element whose only open is the error state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'src/app/components/ContentFlowSnapshotPanel.tsx'), 'utf8');

test('the panel stays a collapsed-by-default details element; the error state is its only open', () => {
  assert.match(panel, /<details/);
  assert.equal((panel.match(/open=/g) || []).length, 1, 'exactly one open assignment');
  assert.match(panel, /open=\{snapshot\.status === 'error' \? true : undefined\}/,
    'open only on the error state; every other state renders collapsed');
});
