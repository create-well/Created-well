// Audit #7 residue (register 1500): (1) the mobile hamburger carries its
// accessible name; (2) the custom-domain notice renders on the System
// surface only, never in the RootLayout stack (UX ruling 1497).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const topnav = readFileSync(new URL('../src/app/components/TopNav.tsx', import.meta.url), 'utf8');
const root = readFileSync(new URL('../src/app/RootLayout.tsx', import.meta.url), 'utf8');
const system = readFileSync(new URL('../src/app/pages/SystemPage.tsx', import.meta.url), 'utf8');

test('the hamburger button carries the accessible name Menu', () => {
  assert.match(topnav, /<button className="hamburger" aria-label="Menu"/);
});

test('no other hamburger-shaped button exists in TopNav', () => {
  assert.equal((topnav.match(/className="hamburger"/g) || []).length, 1);
});

test('RootLayout renders no domain banner and keeps no dismissal state', () => {
  assert.doesNotMatch(root, /showDomainBanner/);
  assert.doesNotMatch(root, /cr8w_domain_banner_dismissed/);
  assert.doesNotMatch(root, /Custom domain is setting up/);
  assert.doesNotMatch(root, /Bookmark this page/);
});

test('the domain state renders as a System surface row keyed on the real hostname', () => {
  assert.match(system, /Custom domain/);
  assert.match(system, /window\.location\.hostname === 'createwell\.monnyfest\.co'/);
  assert.match(system, /Setting up — you're viewing via the direct link/);
});

test('the domain row value takes the readable text color, not a status tone', () => {
  assert.match(system, /color: 'var\(--text-secondary, #443855\)', fontWeight: 600/);
});

const well = readFileSync(new URL('../src/app/components/NotesFromTheWell.tsx', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../src/app/components/HubView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app/cr8w.css', import.meta.url), 'utf8');

test('Drop takes the ruled treatment: transparent, primary-text border and text, 44px', () => {
  assert.match(well, /border: '1\.5px solid var\(--cr8w-primary-text\)'/);
  assert.match(well, /color: 'var\(--cr8w-primary-text\)'/);
  assert.match(well, /minHeight: 44/);
  assert.doesNotMatch(well, /background: input\.trim\(\) \? 'var\(--cr8w-primary\)'/);
  assert.doesNotMatch(well, /color: '#fff',\n\s+fontFamily: 'var\(--font-label\)',\n\s+fontSize: '0\.72rem'/);
});

test('the empty Drop state is the treatment at reduced opacity, never the tint fill', () => {
  assert.match(well, /opacity: input\.trim\(\) \? 1 : 0\.45/);
  assert.doesNotMatch(well, /--cr8w-primary-rgb, 123,168,157\),0\.3\)/);
});

test('the Drop hover is the treatment tint, not the retired rust fill', () => {
  assert.match(css, /\.well-note-submit-btn:hover:not\(:disabled\) \{\n  background: color-mix\(in srgb, var\(--cr8w-primary-text\) 8%, transparent\);\n\}/);
});

test('the Today chip fill and Tomorrow chip text take the sibling token; the tint stays', () => {
  assert.match(hub, /background: isToday \? 'var\(--cr8w-primary-text, #466F64\)' : isTomorrow \? 'rgba\(var\(--cr8w-primary-rgb, 123,168,157\),0\.15\)'/);
  assert.match(hub, /color: isToday \? '#fff' : isTomorrow \? 'var\(--cr8w-primary-text, #466F64\)'/);
});

test('the Home top stack is nav then the single freshness line', () => {
  const navAt = root.indexOf('<TopNav');
  const barAt = root.indexOf('<SyncStatusBar />');
  const mainAt = root.indexOf('<main className="cr-main">');
  assert.ok(navAt > -1 && barAt > navAt && mainAt > barAt,
    'TopNav, then SyncStatusBar, then main — nothing between the bar and main');
  const between = root.slice(barAt, mainAt);
  assert.doesNotMatch(between, /<div/);
});
