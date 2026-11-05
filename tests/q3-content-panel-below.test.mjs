// Audit-6 Q3 (ruling, register 1506): the "Content and linked Flows" panel
// relocates BELOW the Moves view's primary content, at the foot of the view,
// collapsed by default. Placement only: the panel's content, heading, props,
// and freshness state are unchanged, and the forum slice stays whole (the
// panel is a protected consumer under the 1441/1448 settlement).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const moves = readFileSync(join(root, 'src/app/pages/MovesPage.tsx'), 'utf8');
const panel = readFileSync(join(root, 'src/app/components/ContentFlowSnapshotPanel.tsx'), 'utf8');

test('the panel renders after the primary content, at the foot of the view', () => {
  const geyserStart = moves.indexOf('<GeyserView');
  const geyserClose = moves.indexOf('/>', geyserStart);
  const panelAt = moves.indexOf('<ContentFlowSnapshotPanel');
  assert.ok(geyserStart > -1 && panelAt > geyserClose, 'panel sits below the GeyserView primary content');
  assert.ok(panelAt < moves.indexOf('{showAddTask'), 'panel sits before the modal, inside the view shell');
  assert.ok(panelAt < moves.indexOf('</ViewShell>'), 'panel stays inside the shell');
});

test('exactly one panel render site in the Moves view', () => {
  assert.equal((moves.match(/<ContentFlowSnapshotPanel/g) || []).length, 1);
});

test('the panel stays a collapsed-by-default details element; the error state is its only open', () => {
  assert.match(panel, /<details/);
  assert.equal((panel.match(/open=/g) || []).length, 1, 'exactly one open assignment');
  assert.match(panel, /open=\{snapshot\.status === 'error' \? true : undefined\}/,
    'open only on the error state; every other state renders collapsed');
});

test('heading and props unchanged by the move', () => {
  assert.match(panel, /Content and linked Flows/);
  assert.match(moves, /<ContentFlowSnapshotPanel snapshot=\{data\.contentFlowSnapshot\} onRetry=\{actions\.retrySync\} \/>/);
});

test('the forum slice stays whole: the move touches no data path', () => {
  assert.match(moves, /forumNotesForView = data\.forum\.filter\(f => !f\.registryMirror\)/);
  assert.match(moves, /forum=\{data\.forum\.filter\(f => !f\.registryMirror\)\}/);
  assert.doesNotMatch(moves, /contentFlowSnapshot\s*=/, 'the snapshot is passed through, never reshaped here');
});
