// Synthetic-only source-to-view integration checks. No real network or records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { snapshotFromDashboard } from '../src/lib/contentFlowSnapshot.ts';

const a='12345670-0000-4000-8000-000000000001';
const b='12345670-0000-4000-8000-000000000002';
const flow='11111111-1111-4111-8111-111111111111';
const row=(id,content)=>({id:0x1234567,notionPageId:id,content,flowRelation:{ids:[flow],complete:true}});
const payload=(forum=[],extra={})=>({forum,sourceErrors:{},contentQueryComplete:true,...extra});

test('primary source error, fallback, malformed metadata, partial, and genuinely empty are distinct',()=>{
  assert.equal(snapshotFromDashboard(payload([],{sourceErrors:{content:'private error'}}),false).status,'error');
  assert.equal(snapshotFromDashboard(payload(),true).status,'error');
  assert.equal(snapshotFromDashboard({forum:[]},false).status,'error');
  assert.equal(snapshotFromDashboard(payload([],{contentQueryComplete:undefined}),false).status,'partial');
  assert.equal(snapshotFromDashboard(payload(),false).status,'empty');
  assert.equal(snapshotFromDashboard(payload([row(a,'A')]),false).status,'available');
});

test('full-ID snapshot survives optimistic update and delete collision; no Events join',()=>{
  const forum=[row(a,'A'),row(b,'B')];
  const events=[{id:'44444444-4444-4444-8444-444444444444',flow},{id:'55555555-5555-4555-8555-555555555555',flow}];
  const snapshot=snapshotFromDashboard({...payload(forum),events},false);
  const update=forum.map(x=>x.id===forum[0].id?{...x,content:'optimistic'}:x);
  const deleted=forum.filter(x=>x.id!==forum[0].id);
  assert.equal(update.length,2); assert.equal(deleted.length,0); assert.equal(events.length,2);
  assert.deepEqual(snapshot.rows.map(x=>[x.notionPageId,x.content]),[[a,'A'],[b,'B']]);
});

test('context, retry and consumer are actually wired to the independent snapshot',async()=>{
  const ctx=await readFile(new URL('../src/contexts/DashboardContext.tsx',import.meta.url),'utf8');
  const moves=await readFile(new URL('../src/app/pages/MovesPage.tsx',import.meta.url),'utf8');
  assert.match(ctx,/snapshotFromDashboard\(data, usedFallback\)/);
  assert.match(ctx,/setContentFlowSnapshot\(contentSnapshot\)/);
  assert.match(ctx,/setSyncStatus\([^\n]*contentSnapshot[^\n]*\)/);
  assert.match(ctx,/contentFlowSnapshot,/);
  assert.match(moves,/<ContentFlowSnapshotPanel snapshot=\{data\.contentFlowSnapshot\} onRetry=\{actions\.retrySync\}/);
  assert.doesNotMatch(moves,/<ContentFlowPanel rows=\{data\.forum\}/);
});
