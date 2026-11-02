import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialMoveFormValues,
  isMoveFormDirty,
  validateMoveForm,
  classifyCreateError,
  initialMoveFormState,
  moveFormReducer,
  canSubmitMoveForm,
  moveFormCloseIntent,
  buildMovePayload,
} from '../src/lib/moveForm.ts';

const base = initialMoveFormValues('monny');

test('payload: built from form values only — an explicit Unassigned submits empty', () => {
  const payload = buildMovePayload({ ...base, person: '', title: '  Ship it  ' });
  assert.equal(payload.person, '');
  assert.equal(payload.title, 'Ship it');
  assert.equal(payload.status, 'todo');
  assert.equal(payload.due_date, base.dueDate);
  assert.equal(buildMovePayload({ ...base, person: 'bingle' }).person, 'bingle');
});

test('assignee ruling: empty start is clean, optional, and valid', () => {
  const empty = initialMoveFormValues('');
  assert.equal(empty.person, '');
  assert.equal(isMoveFormDirty(empty, empty), false);
  // Picking a person later is an ordinary edit (dirty); the empty
  // assignee never fails validation — the field is optional.
  assert.equal(isMoveFormDirty({ ...empty, person: 'bingle' }, empty), true);
  assert.deepEqual(validateMoveForm({ ...empty, title: 'A move' }), {});
});

test('validation: empty and whitespace-only titles are rejected in place', () => {
  assert.equal(validateMoveForm(base).title, 'Give the Move a title.');
  assert.equal(validateMoveForm({ ...base, title: '   ' }).title, 'Give the Move a title.');
  assert.deepEqual(validateMoveForm({ ...base, title: 'Ship it' }), {});
});

test('dirty: any field change marks the form dirty; identical values stay clean', () => {
  assert.equal(isMoveFormDirty(base, base), false);
  assert.equal(isMoveFormDirty({ ...base, title: 'x' }, base), true);
  assert.equal(isMoveFormDirty({ ...base, priority: 'high' }, base), true);
  assert.equal(isMoveFormDirty({ ...base, dueDate: '2026-11-03' }, base), true);
});

test('classifier: 4xx in the req() message format is a definite rejection', () => {
  assert.equal(classifyCreateError(new Error('POST /tasks → 422: Unprocessable')), 'definite');
  assert.equal(classifyCreateError(new Error('POST /tasks → 401: Unauthorized')), 'definite');
});

test('classifier: 5xx and status-less failures are unknown outcomes', () => {
  assert.equal(classifyCreateError(new Error('POST /tasks → 500: Internal')), 'unknown');
  assert.equal(classifyCreateError(new Error('POST /tasks → 503: Unavailable')), 'unknown');
  assert.equal(classifyCreateError(new TypeError('Failed to fetch')), 'unknown');
  assert.equal(classifyCreateError(new DOMException('Aborted', 'AbortError')), 'unknown');
  assert.equal(classifyCreateError(null), 'unknown');
});

test('lifecycle: submit locks, duplicate submit is ignored, resolve finishes', () => {
  const submitting = moveFormReducer(initialMoveFormState, { type: 'submit' });
  assert.equal(submitting.phase, 'submitting');
  assert.equal(moveFormReducer(submitting, { type: 'submit' }).phase, 'submitting');
  assert.equal(moveFormReducer(submitting, { type: 'resolved' }).phase, 'done');
  assert.equal(canSubmitMoveForm(initialMoveFormState), true);
  assert.equal(canSubmitMoveForm(submitting), false);
});

test('lifecycle: definite failure keeps a safe retry; editing returns to editing', () => {
  const submitting = moveFormReducer(initialMoveFormState, { type: 'submit' });
  const failed = moveFormReducer(submitting, { type: 'rejected', kind: 'definite' });
  assert.equal(failed.phase, 'failed-definite');
  assert.equal(canSubmitMoveForm(failed), true);
  assert.equal(moveFormReducer(failed, { type: 'submit' }).phase, 'submitting');
  assert.equal(moveFormReducer(failed, { type: 'edit' }).phase, 'editing');
});

test('lifecycle: unknown failure blocks retry until reconciliation', () => {
  const submitting = moveFormReducer(initialMoveFormState, { type: 'submit' });
  const failed = moveFormReducer(submitting, { type: 'rejected', kind: 'unknown' });
  assert.equal(failed.phase, 'failed-unknown');
  assert.equal(canSubmitMoveForm(failed), false);
  assert.equal(moveFormReducer(failed, { type: 'submit' }).phase, 'failed-unknown');
  assert.equal(moveFormReducer(failed, { type: 'edit' }).phase, 'failed-unknown');
  assert.equal(moveFormReducer(failed, { type: 'reconciled' }).phase, 'editing');
});

test('close intent: pending blocks, dirty asks, clean closes', () => {
  const submitting = moveFormReducer(initialMoveFormState, { type: 'submit' });
  assert.equal(moveFormCloseIntent(submitting, true), 'blocked-pending');
  assert.equal(moveFormCloseIntent(submitting, false), 'blocked-pending');
  assert.equal(moveFormCloseIntent(initialMoveFormState, true), 'confirm-discard');
  assert.equal(moveFormCloseIntent(initialMoveFormState, false), 'close');
  assert.equal(moveFormCloseIntent({ phase: 'done' }, true), 'close');
});
