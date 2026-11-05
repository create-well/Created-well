// FIX 4 sweep, Class 1 B — NotesFromTheWell seed notes.
// The Spring draws from SEED_NOTES (17 starter aphorisms carried in
// the bundle) mixed indistinguishably with real community well
// notes. The seeds stay — they are the well's starter words, several
// of them the team's own operating lines — but a drawn seed now
// wears a visible "seed note" tag so no one mistakes it for a
// community drop. Real notes (id > 0) render untagged, as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/components/NotesFromTheWell.tsx'), 'utf8');

test('a drawn seed is tagged as a seed note', () => {
  assert.ok(src.includes('currentNote.id < 0'));
  assert.ok(src.includes('seed note — starter words from the well, not a community drop'));
});

test('the seed stream itself is unchanged', () => {
  assert.ok(src.includes('const SEED_NOTES'));
  assert.ok(src.includes('...wellNotes'));
});
