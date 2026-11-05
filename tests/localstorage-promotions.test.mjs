// Fix 3 (Kimi support pass): state that presented as content but synced
// nowhere is promoted to its KV record or labeled device-local.
// - Message reactions ride Message.reactions via the messages resource.
// - Brain-dump sent/archived flags ride the dump record.
// - Workshop RSVPs stay localStorage by named decision and are labeled
//   "saved on this device" in the UI; promotion is an API-lane follow-up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toggleReactionMap } from '../src/lib/messageReactions.ts';

test('toggleReactionMap adds, removes, and prunes without mutating the input', () => {
  const start = { '❤️': ['sunshine'] };
  const added = toggleReactionMap(start, '❤️', 'monny');
  assert.deepEqual(added, { '❤️': ['sunshine', 'monny'] });
  assert.deepEqual(start, { '❤️': ['sunshine'] }, 'input untouched');
  const removed = toggleReactionMap(added, '❤️', 'sunshine');
  assert.deepEqual(removed, { '❤️': ['monny'] });
  const pruned = toggleReactionMap(removed, '❤️', 'monny');
  assert.deepEqual(pruned, {});
  assert.deepEqual(toggleReactionMap(undefined, '🔥', 'bingle'), { '🔥': ['bingle'] });
});

test('the drawer holds no localStorage reaction store and renders from the record', async () => {
  const drawer = await readFile(new URL('../src/app/components/MessageDrawer.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(drawer, /cr8w_chat_reactions/);
  assert.doesNotMatch(drawer, /localReactions/);
  assert.match(drawer, /msg\.reactions/);
  assert.match(drawer, /onUpdateFields\(msgId, \{ reactions: toggleReactionMap/);
});

test('brain-dump flags ride the record; the localStorage flag sets are gone', async () => {
  const hub = await readFile(new URL('../src/app/components/HubView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(hub, /cr8w_dump_sent_pg/);
  assert.doesNotMatch(hub, /dump_archive/);
  assert.match(hub, /onUpdateBrainDump\(dump\.id, \{ sent_to_playground: true \}\)/);
  assert.match(hub, /onUpdateBrainDump\(id, \{ archived: true \}\)/);
  const api = await readFile(new URL('../src/app/components/api.ts', import.meta.url), 'utf8');
  assert.match(api, /updateBrainDump/);
  assert.match(api, /sent_to_playground\?: boolean/);
  assert.match(api, /archived\?: boolean/);
});

test('workshop RSVPs are labeled device-local in the UI (named decision)', async () => {
  const hub = await readFile(new URL('../src/app/components/HubView.tsx', import.meta.url), 'utf8');
  assert.match(hub, /saved on this device/);
});
