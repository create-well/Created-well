// Phase 3 consent pins (packet M §8, A1/A7): the gate fork and the
// per-person CTA suppression rule, in all of its states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PEOPLE_GATE_MODE,
  peopleSurfaceRestricted,
  contactSuppressed,
  isDoNotContact,
} from '../src/lib/peopleConsent.ts';

test('D1 ships CTA-scoped: the surface is not restricted by the census', () => {
  assert.equal(PEOPLE_GATE_MODE, 'cta-scoped');
  // On today's census shape (gaps > 0, careConsent false) the views
  // render under (b); restriction is the not-granted case only.
  assert.equal(peopleSurfaceRestricted(false), false);
  assert.equal(peopleSurfaceRestricted(true), false);
});

test('A7 fork, global position: restriction follows the census exactly as before', () => {
  assert.equal(peopleSurfaceRestricted(false, 'global'), true);
  assert.equal(peopleSurfaceRestricted(true, 'global'), false);
});

test('captured consent opens contact actions for that person only', () => {
  assert.equal(contactSuppressed({ consentCaptured: true, status: 'Rooted' }), false);
  assert.equal(contactSuppressed({ consentCaptured: true }), false);
});

test('not captured suppresses', () => {
  assert.equal(contactSuppressed({ consentCaptured: false, status: 'Curious' }), true);
});

test('A1: an absent consentCaptured field suppresses — absence is never permission', () => {
  assert.equal(contactSuppressed({ status: 'Exploring' }), true);
  assert.equal(contactSuppressed({}), true);
});

test('Do Not Contact suppresses even with captured consent', () => {
  const p = { consentCaptured: true, status: 'Do Not Contact' };
  assert.equal(isDoNotContact(p), true);
  assert.equal(contactSuppressed(p), true);
});

test('stage-less rows (the dominant live shape) are not Do Not Contact', () => {
  assert.equal(isDoNotContact({ status: 'active' }), false);
  assert.equal(isDoNotContact({}), false);
});
