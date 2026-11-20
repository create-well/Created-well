// M-1 (Money view): the normalizer projects Direction + Stage (M-1c),
// signing follows Direction only, the net never absorbs an undirected
// record, Recent Activity is the last 5 by date desc, the ledger is
// every record in the same order, and the Needs Category queue holds
// exactly the feed's 'Needs category' records (Phase 5, packet LL).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMoney } from '../src/lib/notionNormalizer.ts';
import {
  moneyDirection, signedAmount, recentActivity, moneyTotals, ledgerOrder, needsCategoryQueue,
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

test('ledgerOrder returns every record newest first, with no cap', () => {
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
  assert.deepEqual(ledgerOrder(rows).map(r => r.id), ['b', 'e', 'f', 'c', 'g', 'a', 'd']);
  assert.equal(ledgerOrder(rows).length, rows.length);
});

test('needsCategoryQueue holds exactly the Needs category records, in ledger order', () => {
  const rec = (id, date, kind) => ({
    id, name: id, amount: 1, kind, direction: 'In', stage: 'Received',
    date, flowId: '', docUrl: '', notionPageId: id, created_at: `${date}T00:00:00Z`,
  });
  const rows = [
    rec('a', '2026-10-01', 'Needs category'),
    rec('b', '2026-11-03', 'Ticket sales'),
    rec('c', '2026-10-20', 'Needs category'),
    rec('d', '2026-11-05', ''),
  ];
  assert.deepEqual(needsCategoryQueue(rows).map(r => r.id), ['c', 'a']);
  assert.deepEqual(needsCategoryQueue([rows[1], rows[3]]), []);
});
