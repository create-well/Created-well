// Packet CC honesty leg — surfaces stop claiming live, fresh, or
// empty when the truth is stale, failed, or never loaded. Failing-
// state pins: a failed read renders the fallback label, never a
// calm empty; stale renders stale; fabrications are gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kvSliceError } from '../src/lib/kvSliceState.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const thisWeek = read('src/app/pages/ThisWeekPage.tsx');
const decisions = read('src/app/pages/DecisionsPage.tsx');
const drawer = read('src/app/components/MessageDrawer.tsx');
const layout = read('src/app/RootLayout.tsx');
const hub = read('src/app/components/HubView.tsx');
const fcc = read('src/app/components/FlowCommandCenter.tsx');
const context = read('src/contexts/DashboardContext.tsx');
const payloadType = read('src/types/dashboard.ts');

// ── Item 1: silent KV fallback surfacing ─────────────────────────────────────

test('kvSliceError: a named failure surfaces, absent and empty do not', () => {
  assert.equal(kvSliceError({ 'kv:cr8w_messages': 'connection reset' }, 'kv:cr8w_messages'), 'connection reset');
  assert.equal(kvSliceError(undefined, 'kv:cr8w_messages'), null);
  assert.equal(kvSliceError({}, 'kv:cr8w_messages'), null);
  assert.equal(kvSliceError({ 'kv:cr8w_messages': '' }, 'kv:cr8w_messages'), null);
});

test('the payload carries sourceErrors through the context and the type', () => {
  assert.ok(context.includes('setSourceErrors(usedFallback ? undefined : data.sourceErrors)'));
  assert.ok(context.includes('sourceErrors,'));
  assert.ok(payloadType.includes('sourceErrors?: Record<string, string>'));
});

test('failed reads name the fallback state, never a calm empty', () => {
  // Decisions: an empty queue under a read failure is not "clear".
  assert.ok(decisions.includes("kvSliceError(data.sourceErrors, 'kv:cr8w_decisions')"));
  assert.ok(decisions.includes('The decision queue could not be read'));
  assert.ok(decisions.includes('this is not an empty queue'));
  // Drawer: a failed messages read is not "no messages yet".
  assert.ok(drawer.includes('messagesError'));
  assert.ok(drawer.includes('Messages could not be read'));
  assert.match(layout, /messagesError=\{kvSliceError\(data\.sourceErrors, 'kv:cr8w_messages'\)\}/);
  // Today: brain dumps and well notes name their failed slices.
  assert.ok(hub.includes("kvSliceError(sourceErrors, 'kv:cr8w_braindumps')"));
  assert.ok(hub.includes("kvSliceError(sourceErrors, 'kv:cr8w_well_notes')"));
  assert.ok(hub.includes('Brain dumps could not be read'));
  assert.ok(hub.includes('Well notes could not be read'));
});

// ── Item 2: stale mappings and dead retries ──────────────────────────────────

test('stale renders stale on Today and Decisions; the Decisions retry is real', () => {
  assert.match(thisWeek, /data\.syncStatus === 'stale' \? 'stale' : 'fresh'/);
  assert.match(decisions, /data\.syncStatus === 'stale' \? 'stale' : 'fresh'/);
  assert.ok(decisions.includes('onRetry={() => { actions.retrySync(); }}'));
  assert.ok(!decisions.includes('onRetry={() => {}}'));
});

// ── Item 3: FlowCommandCenter fabrications ───────────────────────────────────

test('FCC shows only state it reads: no invented date, topic, or holds', () => {
  assert.ok(!fcc.includes('nextFriday'));
  assert.ok(!fcc.includes('How do we make room for the work before it has a name'));
  assert.ok(fcc.includes('Date to be named'));
  assert.ok(fcc.includes('No flow is filed on the board yet'));
  assert.ok(!fcc.includes('person: "Monny"'));
  assert.ok(!fcc.includes('person: "Sunshine"'));
  assert.ok(!fcc.includes('person: "Bingle"'));
  assert.ok(!fcc.includes('person: "Omar"'));
  assert.ok(fcc.includes('flow?.keeperName || "Unfilled"'));
  // The provenance line names the true source and stays.
  assert.ok(fcc.includes('Data source · FLOWS (Notion) · useDashboard().data.coFlowDates'));
});

// ── Item 4: the drawer Reply composer black hole ─────────────────────────────

test('the reply composer is gone; no pretend send path remains', () => {
  assert.ok(!drawer.includes('chatReplies'));
  assert.ok(!drawer.includes('replyToId'));
  assert.ok(!drawer.includes('openReplies'));
  assert.ok(!drawer.includes('Replying to'));
  assert.ok(!drawer.includes('Reply</button>'));
  assert.ok(!drawer.includes('Reply to ${'));
});
