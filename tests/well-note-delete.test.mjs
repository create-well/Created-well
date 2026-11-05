// Register 1424 — the well-notes delete affordance, mirroring
// the decisions delete (1293). Server side verified firsthand:
// 'well-notes' rides the generic resource router (api/server.ts
// resource map), so the generic list DELETE covers
// cr8w_well_notes exactly as it covers cr8w_decisions — no
// server change. Client: an api fn, a context action on the D-1
// honesty contract (await, apply, rethrow — the surface owns its
// error line), and the two-step control on the store's ONE
// render surface. PREMISE CORRECTED in the packet: GeyserView's
// well section renders FORUM posts reshaped as notes
// (MovesPage's forumNotesForView) and writes forum posts — the
// store never renders there, and forum posts already carry
// their own delete path. The control renders only for real
// store notes (seed notes carry negative ids and are not
// records). Armed state follows the landed rulings: 44px, and
// #B3261E for label, border, and the error line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = readFileSync(join(root, 'src/app/components/api.ts'), 'utf8');
const ctx = readFileSync(join(root, 'src/contexts/DashboardContext.tsx'), 'utf8');
const types = readFileSync(join(root, 'src/types/dashboard.ts'), 'utf8');
const well = readFileSync(join(root, 'src/app/components/NotesFromTheWell.tsx'), 'utf8');
const server = readFileSync(join(root, 'api/server.ts'), 'utf8');

test('the server already serves the delete (generic resource router)', () => {
  assert.ok(server.includes("'well-notes': 'cr8w_well_notes'"));
});

test('client path: api fn, interface line, await-apply-rethrow action', () => {
  assert.ok(api.includes("export const deleteWellNote = (id: number) => req<{ ok: boolean }>('DELETE', `/well-notes/${id}`);"));
  assert.ok(types.includes('deleteWellNote: (id: number) => Promise<void>;'));
  const body = ctx.match(/async deleteWellNote\(id: number\) \{[^}]+\}/)?.[0] ?? '';
  assert.ok(body.includes('await api.deleteWellNote(id);'));
  assert.ok(body.includes('setWellNotes(prev => prev.filter(n => n.id !== id));'));
  assert.ok(!body.includes('catch'));
});

test('the two-step control follows the landed treatment', () => {
  assert.ok(well.includes("confirming ? '#B3261E' : 'var(--text-muted)'"));
  assert.ok(well.includes("confirming ? '1px solid #B3261E' : '1px solid transparent'"));
  assert.ok(well.includes('minHeight: 44'));
  assert.ok(well.includes("'That did not delete. Check the connection and try again.'"));
  assert.ok(!well.includes("confirming ? '#FF453A'"));
});

test('the control renders only for real store notes', () => {
  assert.ok(well.includes('onDeleteNote && currentNote && currentNote.id > 0'));
  assert.ok(well.includes('key={currentNote.id}'));
});
