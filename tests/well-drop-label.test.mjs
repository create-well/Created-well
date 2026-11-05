// FIX 4 sweep, Class 1 A — MessageDrawer "Well Sync" attribution.
// A "Well Drop" is a message type any user picks in the composer; it
// only prepends [FORUM] to the text. The drawer's timestamp line
// attributed those hand-typed messages as "Well Sync", implying they
// were synchronized from The Well. The label now matches the type's
// own user-facing name — the same words the composer (:30) and the
// message header already use. The digest's "well drops" count stands:
// it counts the type under its own name, which is honest once the
// sync claim is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/components/MessageDrawer.tsx'), 'utf8');

test('no Well Sync attribution anywhere in the drawer', () => {
  assert.ok(!src.includes('Well Sync'));
});

test('the attribution uses the type vocabulary', () => {
  assert.ok(src.includes("prefix === 'FORUM' ? 'Well Drop' :"));
});
