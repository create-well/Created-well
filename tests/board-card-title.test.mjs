// Micro-packet 2026-11-14 (exec commission on the Phase 2a
// landing observation): FlowCard leads with the row's filed
// Name. Before the fix the card read the Theme only, so the
// board's SLO cards read "Untitled Flow" and "Off-site" while
// their detail pages carried the proper names. Pins: the
// heading choice over the live SLO rows' property shapes, the
// fallback order, and the component wiring (heading through
// flowHeading; the theme renders second, only when it differs
// from the title).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeFlow } from '../src/lib/notionNormalizer.ts';
import { flowHeading } from '../src/lib/flows.ts';

const sel = (name) => ({ type: 'select', select: { id: 'x', name, color: 'default' } });
const title = (text) => ({ type: 'title', title: [{ plain_text: text, href: null }] });
const rich = (text) => ({ type: 'rich_text', rich_text: [{ plain_text: text, href: null }] });

const page = (props, id = '3f024acf-799d-81fb-92c8-d733da89cb22') => ({
  id,
  created_time: '2026-10-01T00:00:00.000Z',
  last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    Name: title('A flow'),
    Date: { type: 'date', date: { start: '2026-11-05', end: null, time_zone: null } },
    Status: sel('Upcoming'),
    ...props,
  },
});

test('the SLO cards read their filed names on the board', () => {
  const nov18 = normalizeFlow(page({
    Series: sel('SLO Create'), Name: title('SLO Create (11/18)'),
  }));
  assert.equal(flowHeading(nov18), 'SLO Create (11/18)',
    'Theme empty: the name leads, not "Untitled Flow"');
  const night = normalizeFlow(page({
    Series: sel('SLO Create'), Type: sel('Off-site'),
    Theme: rich('Off-site'), Name: title('SLO Create night'),
  }));
  assert.equal(flowHeading(night), 'SLO Create night',
    'Theme "Off-site": the name leads, the theme renders second');
  const mosaic = normalizeFlow(page({
    Series: sel('SLO Create'), Name: title('SLO Create: Mosaic Mirrors (10/15)'),
  }));
  assert.equal(flowHeading(mosaic), 'SLO Create: Mosaic Mirrors (10/15)');
});

test('fallback order: title, then theme, then the honest placeholder', () => {
  const themed = normalizeFlow(page({ Name: title(''), Theme: rich('Podyap') }));
  assert.equal(flowHeading(themed), 'Podyap');
  const bare = normalizeFlow(page({ Name: title('') }));
  assert.equal(flowHeading(bare), 'Untitled Flow');
});

test('source: FlowCard renders the heading through flowHeading, theme second', () => {
  const community = readFileSync(new URL('../src/app/components/CommunityEventsView.tsx', import.meta.url), 'utf8');
  assert.match(community, /\{flowHeading\(flow\)\}/);
  assert.match(community, /flow\.theme && flow\.title && flow\.theme !== flow\.title/);
  assert.doesNotMatch(community, /\{flow\.theme \|\| 'Untitled Flow'\}/);
});
