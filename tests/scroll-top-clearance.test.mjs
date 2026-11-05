// F1b (external-audit verification, rank C): the two bottom-left fixed
// stacks overlapped — the Decomprocess cluster spans bottom 20-104px
// (base 20 + FAB 52 + gap 6 + history mini 26) while the scroll-top
// button sat at bottom 84 (span 84-130), partially covering the
// history mini-button whenever it was visible. F1b raised the button
// to 116. The Audit-2 pass made the button inset-aware: its bottom is
// now calc(116px + max(0, inset - 20px)), so the 12px gap above the
// cluster holds at EVERY safe-area inset (past 32px the old fixed
// value let the cluster rise into the button).
//
// Audit-2 (rank C, QA geometry): below 1172px viewport width the
// content column runs under the fixed stack, whose union top is the
// scroll-top top (162px at a zero inset). .cr-main therefore carries
// a narrow-width bottom padding of 170px growing 1:1 with the inset
// past 20px — exactly the button's lift — so the final content slice
// scrolls clear of the stack at every width and inset. Desktop keeps
// the 80px padding (at 1172px and up the column clears the stack
// horizontally; QA's desktop verdict was NOT REPRODUCED).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = await readFile(new URL('../src/app/RootLayout.tsx', import.meta.url), 'utf8');
const fab = await readFile(new URL('../src/app/components/DecomprocessFAB.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/app/cr8w.css', import.meta.url), 'utf8');

const px = (re, text, label) => {
  const m = text.match(re);
  assert.ok(m, `could not read ${label}`);
  return Number(m[1]);
};

// The scroll-top bottom expression: calc(<base>px + max(0px, env(safe-area-inset-bottom, 0px) - <offset>px))
const scrollExpr = root.match(/scroll-top-btn[\s\S]{0,400}?bottom:\s*'calc\((\d+)px \+ max\(0px, env\(safe-area-inset-bottom, 0px\) - (\d+)px\)\)'/);
assert.ok(scrollExpr, 'scroll-top bottom must be the inset-aware calc expression');
const scrollBase = Number(scrollExpr[1]);
const scrollOffset = Number(scrollExpr[2]);

const clusterBase = px(/bottom:\s*'max\((\d+)px,/, fab, 'cluster base bottom');
const clusterBlock = fab.slice(fab.indexOf('FAB cluster'));
const clusterGap = px(/flexDirection:\s*'column',[\s\S]{0,200}?gap:\s*(\d+)/, clusterBlock, 'cluster gap');
const miniHeight = px(/title="decomprocess history"[\s\S]{0,400}?height:\s*(\d+)/, fab, 'history mini height');
const fabHeight = px(/\.decomprocess-fab\s*\{[^}]*height:\s*(\d+)px/, css, 'FAB height');
const scrollHeight = px(/\.scroll-top-btn\s*\{[^}]*height:\s*(\d+)px/, css, 'scroll-top height');

const clusterTop = (inset) => Math.max(clusterBase, inset) + fabHeight + clusterGap + miniHeight;
const scrollBottom = (inset) => scrollBase + Math.max(0, inset - scrollOffset);
const INSETS = [0, 20, 32, 34, 47];

test('scroll-top button clears the Decomprocess cluster at every safe-area inset', () => {
  for (const inset of INSETS) {
    assert.ok(
      scrollBottom(inset) >= clusterTop(inset) + 8,
      `inset ${inset}px: scroll-top bottom ${scrollBottom(inset)}px must clear cluster top ${clusterTop(inset)}px by at least 8px`,
    );
  }
});

test('narrow-width .cr-main padding clears the whole fixed stack at every inset', () => {
  const rule = css.match(/@media \(max-width: (\d+)px\) \{\s*\.cr-main \{ padding-bottom: calc\((\d+)px \+ max\(0px, env\(safe-area-inset-bottom, 0px\) - (\d+)px\)\); \}\s*\}/);
  assert.ok(rule, 'the narrow-width padding rule must exist in the calc shape');
  assert.equal(Number(rule[1]), 1171, 'the rule applies below the 1172px clearance width');
  const padBase = Number(rule[2]);
  assert.equal(Number(rule[3]), scrollOffset, 'padding and button share the inset offset, so they rise together');
  for (const inset of INSETS) {
    const pad = padBase + Math.max(0, inset - scrollOffset);
    const unionTop = scrollBottom(inset) + scrollHeight;
    assert.ok(pad >= unionTop + 8, `inset ${inset}px: padding ${pad}px must clear stack top ${unionTop}px by at least 8px`);
  }
});

test('desktop .cr-main padding is unchanged', () => {
  assert.match(css, /\.cr-main \{\s*position: relative; z-index: 1;\s*padding-top: var\(--nav-height\);\s*max-width: 1080px; margin: 0 auto;\s*padding-left: 24px; padding-right: 24px; padding-bottom: 80px;\s*\}/);
});
