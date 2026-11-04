// F1b (external-audit verification, rank C): the two bottom-left fixed
// stacks overlapped — the Decomprocess cluster spans bottom 20-104px
// (base 20 + FAB 52 + gap 6 + history mini 26) while the scroll-top
// button sat at bottom 84 (span 84-130), partially covering the
// history mini-button whenever it was visible. This test recomputes
// both spans from the sources of record and requires a clear gap.
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

test('scroll-top button clears the Decomprocess cluster at every scroll point', () => {
  const scrollBottom = px(/scroll-top-btn[\s\S]{0,400}?bottom:\s*'(\d+)px'/, root, 'scroll-top inline bottom');
  const clusterBase = px(/bottom:\s*'max\((\d+)px,/, fab, 'cluster base bottom');
  const clusterBlock = fab.slice(fab.indexOf('FAB cluster'));
  const clusterGap = px(/flexDirection:\s*'column',[\s\S]{0,200}?gap:\s*(\d+)/, clusterBlock, 'cluster gap');
  const miniHeight = px(/title="decomprocess history"[\s\S]{0,400}?height:\s*(\d+)/, fab, 'history mini height');
  const fabHeight = px(/\.decomprocess-fab\s*\{[^}]*height:\s*(\d+)px/, css, 'FAB height');
  const clusterTop = clusterBase + fabHeight + clusterGap + miniHeight;
  assert.ok(
    scrollBottom >= clusterTop + 8,
    `scroll-top bottom ${scrollBottom}px must clear cluster top ${clusterTop}px by at least 8px`,
  );
});
