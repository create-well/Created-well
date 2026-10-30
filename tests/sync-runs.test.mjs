import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSyncRunRow,
  clampSyncRunLimit,
} from '../api/_sync-ledger.ts';

// G-35 / Q-42 Option B: the durable run-history store mapping. The engine
// record is the input; the sync_runs table row is the output. The store
// write itself is fail-soft in the engine (never throws into a sync), so
// the mapping is the leg these tests pin.

const RECORD = {
  startedAt: '2026-10-30T10:00:00.000Z',
  finishedAt: '2026-10-30T10:00:04.250Z',
  durationMs: 4250,
  status: 'partial',
  sources: [
    { source: 'moves', rows: 15, cached: false },
    { source: 'people', rows: 0, cached: false, error: 'boom' },
  ],
  totalRows: 15,
  trigger: 'reconcile',
  deferredSources: ['flows'],
};

test('buildSyncRunRow maps the engine record onto the table columns', () => {
  const row = buildSyncRunRow(RECORD);
  assert.deepEqual(Object.keys(row).sort(), [
    'deferred_sources',
    'duration_ms',
    'finished_at',
    'sources',
    'started_at',
    'status',
    'total_rows',
    'trigger',
  ]);
  assert.equal(row.started_at, RECORD.startedAt);
  assert.equal(row.finished_at, RECORD.finishedAt);
  assert.equal(row.trigger, 'reconcile');
  assert.equal(row.status, 'partial');
  assert.equal(row.total_rows, 15);
  assert.equal(row.duration_ms, 4250);
  assert.deepEqual(row.deferred_sources, ['flows']);
  // Sources pass through as the jsonb payload, unmodified.
  assert.deepEqual(row.sources, RECORD.sources);
});

test('buildSyncRunRow carries an empty deferred list, never undefined', () => {
  const row = buildSyncRunRow({ ...RECORD, deferredSources: [] });
  assert.deepEqual(row.deferred_sources, []);
});

test('clampSyncRunLimit defaults and clamps', () => {
  assert.equal(clampSyncRunLimit(undefined), 50);
  assert.equal(clampSyncRunLimit('abc'), 50);
  assert.equal(clampSyncRunLimit('10'), 10);
  assert.equal(clampSyncRunLimit('0'), 1);
  assert.equal(clampSyncRunLimit('-5'), 1);
  assert.equal(clampSyncRunLimit('999'), 200);
  assert.equal(clampSyncRunLimit('200'), 200);
});
