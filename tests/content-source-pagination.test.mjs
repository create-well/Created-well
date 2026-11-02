// No real network: queryCanonicalNotionDatabase uses a synthetic fetch stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {queryCanonicalNotionDatabase, resetDataSourceIdCache} from '../api/_notion-sources.ts';
const response=body=>({ok:true,status:200,json:async()=>body,headers:{get:()=>null}});
async function withPages(pages,fn){
 const original=globalThis.fetch; let calls=0; resetDataSourceIdCache();
 globalThis.fetch=async(url,init)=>{const u=String(url); if(u.includes('/v1/databases/')&&(!init||init.method!=='POST')) return response({data_sources:[{id:'ds-under-test'}]}); const p=pages[calls++]; if(!p) throw new Error('unexpected pagination'); return response(p);};
 try { await fn(()=>calls); } finally {globalThis.fetch=original;}
}
test('complete two-page CONTENT query follows cursors once and returns both rows',async()=>{
 await withPages([{results:[{id:'first'}],has_more:true,next_cursor:'cursor-a'},{results:[{id:'second'}],has_more:false,next_cursor:null}],async calls=>{
  const rows=await queryCanonicalNotionDatabase('content','synthetic-db','synthetic-secret');
  assert.deepEqual(rows.map(r=>r.id),['first','second']); assert.equal(calls(),2);
 });
});
test('CONTENT query rejects missing results, missing cursor, malformed flag and repeated cursor',async()=>{
 const cases=[
  [{has_more:false,next_cursor:null}],
  [{results:[],has_more:true,next_cursor:null}],
  [{results:[],next_cursor:null}],
  [{results:[],has_more:false}],
  [{results:[],has_more:true,next_cursor:'   '}],
  [{results:[],has_more:true,next_cursor:'same'},{results:[],has_more:true,next_cursor:'same'}],
  [{results:[],has_more:false,next_cursor:'unexpected'}],
 ];
 for(const pages of cases) await withPages(pages,async()=>{
  await assert.rejects(queryCanonicalNotionDatabase('content','synthetic-db','synthetic-secret'),/incomplete pagination/);
 });
});
