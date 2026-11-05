// M-1 (Money view): the normalizer projects Direction + Stage (M-1c),
// signing follows Direction only, the net never absorbs an undirected
// record, Recent Activity is the last 5 by date desc, and the quick-log
// payload carries exactly the M-1b write shape (Kind unset in v1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoney } from '../src/lib/notionNormalizer.ts';
import {
  moneyDirection, signedAmount, recentActivity, moneyTotals, buildMoneyPayload,
} from '../src/lib/moneyView.ts';

const sel = name => ({ type: 'select', select: name ? { id: name, name, color: 'default' } : null });
const page = (id, props, created = '2026-11-01T00:00:00.000Z') => ({
  id, created_time: created, last_edited_time: created, properties: props,
});
const moneyPage = (id, { name, amount, direction, stage, actual }) => page(id, {
  Name: { type: 'title', title: [{ plain_text: name }] },
  Amount: { type: 'number', number: amount },
  Direction: sel(direction),
  Stage: sel(stage),
  Actual: { type: 'date', date: actual ? { start: actual, end: null, time_zone: null } : null },
});

test('normalizeMoney projects direction and stage from the source selects', () => {
  const r = normalizeMoney(moneyPage('aaaaaaaa-1111-4111-8111-111111111111', {
    name: 'Venue fee', amount: 250, direction: 'Out', stage: 'Paid', actual: '2026-10-15',
  }));
  assert.equal(r.direction, 'Out');
  assert.equal(r.stage, 'Paid');
  assert.equal(r.amount, 250);
  const bare = normalizeMoney(moneyPage('bbbbbbbb-2222-4222-8222-222222222222', {
    name: 'Legacy row', amount: 40, direction: null, stage: null, actual: null,
  }));
  assert.equal(bare.direction, '');
  assert.equal(bare.stage, '');
});

test('signing follows Direction; undirected records never sign', () => {
  assert.equal(moneyDirection({ direction: 'In' }), 'in');
  assert.equal(moneyDirection({ direction: 'Out' }), 'out');
  assert.equal(moneyDirection({ direction: '' }), null);
  assert.equal(moneyDirection({ direction: 'Sideways' }), null);
  assert.equal(signedAmount({ direction: 'In', amount: 30 }), 30);
  assert.equal(signedAmount({ direction: 'Out', amount: 30 }), -30);
  assert.equal(signedAmount({ direction: '', amount: 30 }), null);
});

test('totals net only direction-known records and count the undirected', () => {
  const totals = moneyTotals([
    { direction: 'In', amount: 100 },
    { direction: 'Out', amount: 40 },
    { direction: '', amount: 999 },
  ]);
  assert.deepEqual(totals, { income: 100, expenses: 40, net: 60, undirected: 1 });
});

test('recentActivity returns the last 5 by date desc, undated last', () => {
  const rec = (id, date, created) => ({
    id, name: id, amount: 1, kind: '', direction: 'In', stage: 'Received',
    date, flowId: '', docUrl: '', notionPageId: id, created_at: created,
  });
  const rows = [
    rec('a', '2026-10-01', '2026-10-01T00:00:00Z'),
    rec('b', '2026-11-03', '2026-11-03T00:00:00Z'),
    rec('c', '2026-10-20', '2026-10-20T00:00:00Z'),
    rec('d', '', '2026-09-01T00:00:00Z'),
    rec('e', '2026-11-01', '2026-11-01T00:00:00Z'),
    rec('f', '2026-10-25', '2026-10-25T00:00:00Z'),
    rec('g', '2026-10-10', '2026-10-10T00:00:00Z'),
  ];
  assert.deepEqual(recentActivity(rows, 5).map(r => r.id), ['b', 'e', 'f', 'c', 'g']);
  assert.deepEqual(recentActivity(rows).length, 5);
});

test('buildMoneyPayload carries the M-1b write shape and no Kind', () => {
  assert.deepEqual(
    buildMoneyPayload({ label: 'Ticket sales', amount: 75, date: '2026-11-04', direction: 'in' }),
    { name: 'Ticket sales', amount: 75, direction: 'In', actual: '2026-11-04', stage: 'Received' },
  );
  assert.deepEqual(
    buildMoneyPayload({ label: 'Room rental', amount: 120, date: '2026-11-04', direction: 'out' }),
    { name: 'Room rental', amount: 120, direction: 'Out', actual: '2026-11-04', stage: 'Paid' },
  );
  assert.equal('kind' in buildMoneyPayload({ label: 'x', amount: 1, date: '2026-11-04', direction: 'in' }), false);
});
