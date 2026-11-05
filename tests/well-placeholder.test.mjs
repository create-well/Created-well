// UI design call (register 1405 item 2) — the well inputs'
// placeholders rendered the browser default rgb(117,117,117) at
// 4.61:1, an unchosen pass by 0.11. They now take the muted
// token deliberately via ::placeholder, with opacity: 1 —
// load-bearing, because Firefox's default placeholder opacity
// would wash the authored color back below standard; with
// opacity 1 the token color is the rendered color everywhere.
// The quoted "share a thought..." placeholder lives in
// GeyserView's Notes-from-the-Well section input; the named
// component's own well textarea takes the same rule, so the
// class is consistent across the well's inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/app/cr8w.css'), 'utf8');
const geyser = readFileSync(join(root, 'src/app/components/GeyserView.tsx'), 'utf8');
const well = readFileSync(join(root, 'src/app/components/NotesFromTheWell.tsx'), 'utf8');

test('the placeholder rule carries the muted token at full opacity', () => {
  assert.ok(css.includes('.well-note-textarea::placeholder, .well-note-input::placeholder { color: var(--text-muted); opacity: 1; }'));
});

test('both well inputs sit under the rule', () => {
  assert.ok(geyser.includes('className="well-note-input"'));
  assert.ok(well.includes('className="well-note-textarea"'));
});
