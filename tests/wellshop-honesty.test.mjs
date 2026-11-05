// FIX 4 sweep, Class 1 B — HubView wellshop + profile device-local
// state wearing shared-state words. The notify toggle only flips a
// this-browser flag (wellshop_notify_*); nothing sends a
// notification, so its on-state cannot read "notifying" — it now says
// what it is: watching on this device. The profile "currently
// holding" input likewise stores a per-person value in the viewer's
// own browser (profile_holding_*); its label now carries the
// this-device-only marker, matching the RSVP rows' "saved on this
// device" disposition from the localStorage promotions.
// (At the sweep's line map the holding family also included history
// and next fields; on current main only holding renders — verified.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/app/components/HubView.tsx'), 'utf8');

test('the notify toggle claims no notification, only a device watch', () => {
  assert.ok(!src.includes('notifying'));
  assert.ok(!src.includes('notify me'));
  assert.ok(src.includes('watching on this device'));
});

test('the holding label names its device-local scope', () => {
  assert.ok(src.includes('currently holding · this device only'));
});
