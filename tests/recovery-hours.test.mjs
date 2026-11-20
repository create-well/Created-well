// Phase 6 (packet OO §4): recovery hours derive from the archived
// flow's own recorded End Time — never an assumed 22:00. All math is
// local-wall-clock, matching the helper's construction, so the pins
// hold in any timezone the suite runs under.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecoveryHours } from '../src/lib/recoveryHours.ts';

const H = 60 * 60 * 1000;
// Local end instant for a flow on 2026-11-18 ending at h:m.
const endAt = (h, m = 0) => new Date('2026-11-18T00:00:00').getTime() + (h * 60 + m) * 60_000;
const flow = (over = {}) => ({ date: '2026-11-18', status: 'happened', ...over });

test('recorded end governs: 8:30 PM end, 10h elapsed → 62h remain', () => {
  assert.equal(getRecoveryHours([flow({ endTime: '8:30 PM' })], endAt(20, 30) + 10 * H), 62);
});

test('regression: a 4:00 PM end yields MORE remaining than the old 22:00 assumption would', () => {
  // Recorded end 16:00, 30h elapsed → 42 remain. The retired helper
  // assumed 22:00 (24h elapsed) and would have answered 48.
  assert.equal(getRecoveryHours([flow({ endTime: '4:00 PM' })], endAt(16) + 30 * H), 42);
});

test('no recorded end → null (no banner, nothing assumed)', () => {
  assert.equal(getRecoveryHours([flow({})], endAt(20) + H), null);
});

test('unparseable end → null', () => {
  assert.equal(getRecoveryHours([flow({ endTime: 'whenever' })], endAt(20) + H), null);
});

test('real end older than 72h → null', () => {
  assert.equal(getRecoveryHours([flow({ endTime: '8:30 PM' })], endAt(20, 30) + 80 * H), null);
});

test('non-archived flows are ignored', () => {
  assert.equal(getRecoveryHours([flow({ status: 'scheduled', endTime: '8:30 PM' })], endAt(20, 30) + 5 * H), null);
});

test('a future end is skipped; a later archived flow in window still answers', () => {
  const flows = [
    flow({ endTime: '11:30 PM' }), // ends 1h AFTER `now` below
    flow({ endTime: '6:00 PM' }),
  ];
  const now = endAt(22, 30);
  // Second flow: end 18:00, elapsed 4.5h → ceil(67.5) = 68.
  assert.equal(getRecoveryHours(flows, now), 68);
});

test('24-hour end times parse too (18:30)', () => {
  assert.equal(getRecoveryHours([flow({ endTime: '18:30' })], endAt(18, 30) + 2 * H), 70);
});
