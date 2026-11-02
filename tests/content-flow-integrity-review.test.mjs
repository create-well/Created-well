// Previously five red checks against the mutable forum-backed candidate.
// These exercise the new snapshot adapter, status decision and actual panel;
// browser/provider wiring is covered separately by the synthetic preview.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeContent } from '../src/lib/notionNormalizer.ts';
import { snapshotFromDashboard } from '../src/lib/contentFlowSnapshot.ts';
import { sourceStatusesFromDashboard, dashboardStatusForSnapshot } from '../src/lib/canonicalSourceStatus.ts';

const panelPath = fileURLToPath(new URL('../src/app/components/ContentFlowSnapshotPanel.tsx', import.meta.url));
const result = await build({entryPoints:[panelPath],bundle:true,platform:'node',format:'cjs',external:['react'],write:false,logLevel:'silent'});
const m=new Module(panelPath); m.filename=panelPath; m.paths=Module._nodeModulePaths(path.dirname(panelPath)); m._compile(result.outputFiles[0].text,panelPath);
const {ContentFlowSnapshotPanel}=m.exports;
const render=snapshot=>renderToStaticMarkup(React.createElement(ContentFlowSnapshotPanel,{snapshot,onRetry:()=>{}}));
const a='12345670-0000-4000-8000-000000000001', b='12345670-0000-4000-8000-000000000002', flow='11111111-1111-4111-8111-111111111111';
const page=(id,name)=>({id,created_time:'2026-01-01T00:00:00Z',last_edited_time:'2026-01-01T00:00:00Z',properties:{Name:{type:'title',title:[{plain_text:name,href:null}]},Flow:{type:'relation',relation:[{id:flow}],has_more:false}}});
const source=[normalizeContent(page(a,'[ ] original A')),normalizeContent(page(b,'[ ] original B'))];
const payload=(rows=source,errors={},complete=true)=>({forum:rows,sourceErrors:errors,contentQueryComplete:complete});

test('fixture control: full IDs differ although legacy numeric IDs collide',()=>{
 assert.notEqual(a,b); assert.equal(source[0].id,source[1].id);
});
test('CONTENT failure is visibly different from a successfully empty source',()=>{
 const failed=render(snapshotFromDashboard(payload([],{content:'redacted'}),false));
 const empty=render(snapshotFromDashboard(payload([]),false));
 assert.notEqual(failed,empty); assert.match(failed,/unavailable/i); assert.match(empty,/No content records returned/i);
 assert.doesNotMatch(failed,/redacted/);
});
test('CONTENT failure must not be reported fresh',()=>{
 const data=payload([],{content:'redacted'}); const snapshot=snapshotFromDashboard(data,false);
 assert.equal(dashboardStatusForSnapshot(sourceStatusesFromDashboard(data,false),snapshot.status),'stale');
 for(const name of ['moves','people','flows','money']){
  const other=payload(source,{[name]:'redacted'});
  assert.equal(dashboardStatusForSnapshot(sourceStatusesFromDashboard(other,false),snapshotFromDashboard(other,false).status),'stale');
 }
});
test('CONTENT failure exposes an accessible retry action',()=>{
 const html=render(snapshotFromDashboard(payload([],{content:'redacted'}),false));
 assert.match(html,/<button[^>]*>Retry<\/button>/); assert.match(html,/role="alert"/); assert.match(html,/<details[^>]*open/);
});
test('optimistic edits to colliding numeric IDs do not alter source-authority panel',()=>{
 const snapshot=snapshotFromDashboard(payload(),false);
 const optimistic=source.map(p=>p.id===source[0].id?{...p,content:'[ ] optimistic edit'}:p);
 assert.equal(optimistic.length,2); const html=render(snapshot);
 assert.match(html,/\[ \] original A/); assert.match(html,/\[ \] original B/); assert.doesNotMatch(html,/optimistic edit/);
});
test('optimistic deletion of a colliding numeric ID does not remove source-authority rows',()=>{
 const snapshot=snapshotFromDashboard(payload(),false);
 const optimistic=source.filter(p=>p.id!==source[0].id); assert.equal(optimistic.length,0);
 const html=render(snapshot); assert.match(html,/\[ \] original A/); assert.match(html,/\[ \] original B/);
});
test('consumer and context use the separate snapshot and shared retry, not mutable forum',async()=>{
 const context=await readFile(new URL('../src/contexts/DashboardContext.tsx',import.meta.url),'utf8');
 const moves=await readFile(new URL('../src/app/pages/MovesPage.tsx',import.meta.url),'utf8');
 assert.match(context,/snapshotFromDashboard\(data, usedFallback\)/);
 assert.match(context,/dashboardStatusForSnapshot\(sourceStatuses, contentSnapshot.status\)/);
 assert.match(moves,/<ContentFlowSnapshotPanel snapshot=\{data\.contentFlowSnapshot\} onRetry=\{actions\.retrySync\}/);
 assert.doesNotMatch(moves,/<ContentFlowPanel rows=\{data\.forum\}/);
});
