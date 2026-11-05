// Register 1405 (audit #6 leg-4 residue) — the top nav is page
// navigation, not tabs. Two things: (1) aria-current="page" is
// now EXPLICIT in source on every top-nav NavLink. The router
// (react-router 7.18.2, verified in its dist) already defaults
// NavLink's aria-current to "page" on the active link, so the
// runtime behavior does not change — the explicit prop pins the
// intent in the codebase, where leg 4's source census found
// none, immune to a library default change or a refactor.
// (2) A :focus-visible rule covers the top nav in the same shape
// as the existing per-component rules (the Geyser tabs' outline),
// because no global rule covered it. The sub-nav's tablist
// pattern (aria-selected, roving tabIndex) is correct tab
// semantics and is NOT touched by this packet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nav = readFileSync(join(root, 'src/app/components/TopNav.tsx'), 'utf8');
const css = readFileSync(join(root, 'src/app/cr8w.css'), 'utf8');

test('every top-nav NavLink declares aria-current="page" explicitly', () => {
  const links = nav.match(/<NavLink/g) || [];
  const declared = nav.match(/<NavLink aria-current="page"/g) || [];
  assert.equal(links.length, 3);
  assert.equal(declared.length, 3);
});

test('the top nav carries a focus-visible rule in the house shape', () => {
  assert.ok(css.includes('.top-nav :is(a, button):focus-visible { outline: 2px solid var(--cr8w-primary-text, #466F64); outline-offset: 2px; }'));
  // The shape it mirrors still stands (the Geyser tabs' rule).
  assert.ok(css.includes('.geyser-tab:focus-visible { outline: 2px solid var(--cr8w-primary-text, #466F64); outline-offset: 2px; }'));
});
