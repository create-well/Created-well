import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hook = await readFile(new URL('../src/hooks/useWellNotesRealtime.ts', import.meta.url), 'utf8');
const view = await readFile(new URL('../src/views/WellView.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('Well Notes exposes typed loading, live, and error states', () => {
  assert.match(hook, /WellNotesRealtimeStatus = 'loading' \| 'connecting' \| 'live' \| 'error'/);
  assert.match(hook, /const status: WellNotesRealtimeStatus = loading \? 'loading' : error \? 'error' : 'live'/);
  assert.match(view, /data-testid="well-notes-status"/);
  assert.match(view, /aria-live="polite"/);
});

test('retry recovery resets state and recreates the realtime channel', () => {
  assert.match(hook, /setRetryNonce\(value => value \+ 1\)/);
  assert.match(hook, /useEffect\(\(\) => \{ fetchAll\(\); \}, \[fetchAll, retryNonce\]\)/);
  assert.match(hook, /channel\(`well-notes-changes-\$\{retryNonce\}`\)/);
  assert.match(view, /data-testid="well-notes-retry"/);
  assert.match(view, /onClick=\{onRetryWellNotes\}/);
});

test('App retains Well Notes resilience hooks alongside the Decisions route', () => {
  assert.match(app, /useWellNotesRealtime\(\)/);
  assert.match(app, /wellNotesStatus/);
  assert.match(app, /wellNotesError/);
  assert.match(app, /retryWellNotes/);
  assert.match(app, /<DecisionsView tasks=\{tasks\}/);
});

test('main dashboard exposes purposeful operational links', async () => {
  const hub = await readFile(new URL('../src/views/HubView.tsx', import.meta.url), 'utf8');
  assert.match(hub, /label: 'Ops Mirror'/);
  assert.match(hub, /docs\.google\.com\/spreadsheets\/d\/1GBOY57tM-5h-HfHoGllsbnZGv9tgqlNvjvHQW5RVTdA/);
  assert.match(hub, /label: 'Notion Sync Hub'/);
  assert.match(hub, /app\.notion\.com\/p\/ec19c5b25473828b970d81d7012dc08e/);
});

test('retry recovery remains exposed through the Well view contract', () => {
  assert.match(view, /wellNotesStatus === 'error' \|\| wellNotesStatus === 'connecting'/);
  assert.match(view, /wellNotesStatus === 'live' \? '● Well live'/);
  assert.match(view, /onRetryWellNotes/);
});
