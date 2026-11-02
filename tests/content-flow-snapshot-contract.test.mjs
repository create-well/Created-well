// Synthetic contract checks only. No providers, network, or live records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeContentFlowSnapshot } from '../src/lib/contentFlowSnapshot.ts';

const panelPath = fileURLToPath(new URL('../src/app/components/ContentFlowSnapshotPanel.tsx', import.meta.url));
const bundled = await build({entryPoints:[panelPath], bundle:true, platform:'node', format:'cjs', external:['react'], write:false, logLevel:'silent'});
const m = new Module(panelPath); m.filename = panelPath; m.paths = Module._nodeModulePaths(path.dirname(panelPath)); m._compile(bundled.outputFiles[0].text, panelPath);
const { ContentFlowSnapshotPanel } = m.exports;
const render = snapshot => renderToStaticMarkup(React.createElement(ContentFlowSnapshotPanel,{snapshot,onRetry:()=>{}}));
const flow='11111111-1111-4111-8111-111111111111';
const a='12345670-0000-4000-8000-000000000001';
const b='12345670-0000-4000-8000-000000000002';
const row=(id,name,relation={ids:[flow],complete:true})=>({notionPageId:id,content:name,flowRelation:relation});
const success=(rows,complete=true)=>makeContentFlowSnapshot({status:'success',rows,complete});

test('loading, failed with retry, truly empty, partial and available are distinct',()=>{
  const loading=render(makeContentFlowSnapshot({status:'loading'}));
  const error=render(makeContentFlowSnapshot({status:'error'}));
  const empty=render(success([]));
  const partial=render(success([],false));
  const available=render(success([row(a,'Alpha')]));
  assert.match(loading,/loading/i); assert.match(error,/unavailable/i); assert.match(error,/<button[^>]*>Retry/i);
  assert.match(error,/role="alert"/); assert.match(empty,/no content records/i);
  assert.match(partial,/incomplete/i); assert.doesNotMatch(partial,/no content records/i);
  assert.match(available,/Alpha/); assert.equal(new Set([loading,error,empty,partial,available]).size,5);
});

test('snapshot copies full-ID rows, unaffected by later optimistic edit or delete collision',()=>{
  const rows=[row(a,'Alpha'),row(b,'Beta')];
  const snap=success(rows); rows[0].content='Optimistic edit'; rows[1].flowRelation.ids.length=0; rows.length=0;
  const html=render(snap); assert.match(html,/Alpha/); assert.match(html,/Beta/); assert.doesNotMatch(html,/Optimistic edit/);
  assert.deepEqual(snap.rows.map(r=>r.notionPageId),[a,b]); assert.equal(snap.rows[1].flowRelation.ids[0],flow);
});

test('two CONTENT rows linked to one Flow remain two, independent of Events',()=>{
  const events=[{id:'44444444-4444-4444-8444-444444444444',flow},{id:'55555555-5555-4555-8555-555555555555',flow}];
  const snap=success([row(a,'Alpha'),row(b,'Beta')]); const html=render(snap);
  assert.equal(events.length,2); assert.equal(snap.rows.length,2);
  assert.equal((html.match(/Open linked Flow 1/g)||[]).length,4); // accessible label + visible text, twice
  assert.deepEqual(snap.rows.map(r=>r.notionPageId),[a,b]);
});

test('missing, incomplete and invalid relations do not become no-linked-Flow',()=>{
  const snap=success([row(a,'Unknown',null),row(b,'Partial',{ids:[flow,'short'],complete:true})]); const html=render(snap);
  assert.equal(snap.status,'partial'); assert.match(html,/Flow relation unavailable/i); assert.match(html,/Relation may be incomplete/i);
  assert.doesNotMatch(html,/No linked Flow/); assert.doesNotMatch(html,/notion\.com\/p\/short/);
  assert.match(render(success([row(a,'Empty',{ids:[],complete:true})])),/No linked Flow/);
});

test('short, missing or duplicate content identities cannot appear as a complete or empty source',()=>{
  const short=success([row('1234567','Short')]); assert.equal(short.status,'partial'); assert.doesNotMatch(render(short),/no content records/i);
  const dup=success([row(a,'First'),row(a.replaceAll('-',''),'Second')]); assert.equal(dup.status,'partial'); assert.match(render(dup),/incomplete/i);
});

test('retry control calls the supplied retry exactly once',()=>{
  let count=0;
  const tree=ContentFlowSnapshotPanel({snapshot:makeContentFlowSnapshot({status:'error'}),onRetry:()=>{ count++; }});
  function findButton(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'button') return node;
    for (const child of React.Children.toArray(node.props?.children)) { const found=findButton(child); if (found) return found; }
    return null;
  }
  const button=findButton(tree); assert.ok(button); assert.equal(button.props.type,'button');
  button.props.onClick(); assert.equal(count,1);
});

test('optimistic edit and delete by colliding legacy numeric ID leave source projection untouched',()=>{
  const source=[{...row(a,'Alpha'),id:0x1234567},{...row(b,'Beta'),id:0x1234567}];
  const snapshot=success(source);
  const edited=source.map(p=>p.id===0x1234567?{...p,content:'optimistic'}:p);
  const deleted=source.filter(p=>p.id!==0x1234567);
  assert.equal(edited.length,2); assert.equal(deleted.length,0);
  assert.deepEqual(snapshot.rows.map(r=>[r.notionPageId,r.content]),[[a,'Alpha'],[b,'Beta']]);
  assert.doesNotMatch(render(snapshot),/optimistic/);
});
