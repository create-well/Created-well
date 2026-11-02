import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assigneeDescription } from '../src/lib/assigneeLabel.ts';

test('a known role names the person and their role line', () => {
  assert.equal(assigneeDescription('monny', 'Monny', 'The Visionary'), 'Monny — The Visionary');
  assert.equal(assigneeDescription('monny', 'Monny'), 'Monny');
});

test('an empty assignee reads Unassigned', () => {
  assert.equal(assigneeDescription(''), 'Unassigned');
  assert.equal(assigneeDescription('   '), 'Unassigned');
});

test('an unknown stored value is never echoed back', () => {
  const uuid = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const label = assigneeDescription(uuid);
  assert.equal(label, 'Assignee not listed');
  assert.ok(!label.includes(uuid));
  assert.equal(assigneeDescription('some-future-slug'), 'Assignee not listed');
});
