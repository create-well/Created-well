import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTabKey } from '../src/lib/tabList.ts';

test('arrows move and activate, wrapping at both ends', () => {
  assert.deepEqual(resolveTabKey('ArrowRight', 0, 5), { focusIndex: 1, activateIndex: 1 });
  assert.deepEqual(resolveTabKey('ArrowRight', 4, 5), { focusIndex: 0, activateIndex: 0 });
  assert.deepEqual(resolveTabKey('ArrowLeft', 0, 5), { focusIndex: 4, activateIndex: 4 });
  assert.deepEqual(resolveTabKey('ArrowLeft', 3, 5), { focusIndex: 2, activateIndex: 2 });
});

test('Home and End jump to the first and last tab', () => {
  assert.deepEqual(resolveTabKey('Home', 3, 5), { focusIndex: 0, activateIndex: 0 });
  assert.deepEqual(resolveTabKey('End', 1, 5), { focusIndex: 4, activateIndex: 4 });
});

test('Enter and Space activate the focused tab in place', () => {
  assert.deepEqual(resolveTabKey('Enter', 2, 5), { focusIndex: 2, activateIndex: 2 });
  assert.deepEqual(resolveTabKey(' ', 2, 5), { focusIndex: 2, activateIndex: 2 });
});

test('unrelated keys and out-of-range states resolve to nothing', () => {
  assert.equal(resolveTabKey('a', 0, 5), null);
  assert.equal(resolveTabKey('Tab', 0, 5), null);
  assert.equal(resolveTabKey('ArrowRight', 0, 0), null);
  assert.equal(resolveTabKey('ArrowRight', 5, 5), null);
});

test('a single tab wraps to itself', () => {
  assert.deepEqual(resolveTabKey('ArrowRight', 0, 1), { focusIndex: 0, activateIndex: 0 });
});
