import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';

// Actual handler/writer; synthetic auth, KV and fetch. No SDK or network needed.
const moduleURL = code => `data:text/javascript,${encodeURIComponent(code)}`;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return { shortCircuit:true, url:moduleURL(`
    export function createClient(){return {from(){return {
      select(){return {eq(_,key){return {async maybeSingle(){return {data:{value:globalThis.__deleteFixture.store[key]},error:null}}}}}},
      async upsert(row){globalThis.__deleteFixture.store[row.key]=row.value;globalThis.__deleteFixture.writes++;return {error:null}}
    }}}}
  `)};
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_auth.js') return {
    shortCircuit:true, url:moduleURL('export function applyCors(){}; export async function requireSession(){return true}; export async function requireSessionOrCron(){return true};')
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_dashboard-auth.js') return {
    shortCircuit:true, url:new URL('../api/_dashboard-auth.ts',import.meta.url).href
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './workspaceSync.js') return {
    shortCircuit:true, url:moduleURL('export function appendCheckinToWorkspace(){}; export function appendWellNoteToWorkspace(){}; export function canonicalCheckinHash(){return "synthetic"}; export function canonicalNoteHash(){return "synthetic"}; export async function syncWorkspaceToDatabase(){return {status:"ok"}}; export function updateWellNoteInWorkspace(){};')
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './notionWriter.js') return {
    shortCircuit:true, url:new URL('../api/notionWriter.ts',import.meta.url).href
  };
  return next(specifier,context);
}});
const { default:handler } = await import('../api/server.ts');
const savedFetch=globalThis.fetch, savedError=console.error;
const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NOTION_SECRET','NOTION_DB_MOVES'];
const savedEnv=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
after(()=>{hooks.deregister();globalThis.fetch=savedFetch;console.error=savedError;delete globalThis.__deleteFixture;
  for(const k of keys){if(savedEnv[k]===undefined)delete process.env[k];else process.env[k]=savedEnv[k]}
});
const pageId='11111111-1111-4111-8111-111111111111';
async function invoke({method='DELETE',linked=true,providerOK=false,configured=true,resource='tasks',exists=true}={}){
  process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';
  for(const k of ['NOTION_SECRET','NOTION_DB_MOVES']){if(configured)process.env[k]='synthetic';else delete process.env[k];}
  const item={id:42,title:'Synthetic Move',status:'todo',...(linked?{notionPageId:pageId}:{})};
  const key=`cr8w_${resource}`;
  const f=globalThis.__deleteFixture={store:{[key]:JSON.stringify(exists?[item]:[])},writes:0,calls:0};
  globalThis.fetch=async url=>{assert.match(String(url),/^https:\/\/api\.notion\.com\/v1\/pages/);f.calls++;
    return {ok:providerOK,status:providerOK?200:400,json:async()=>({id:pageId}),text:async()=>'SYNTHETIC_PRIVATE_PROVIDER_DETAIL'};
  };
  console.error=()=>{};
  const res={code:200,body:null,setHeader(){return this},status(n){this.code=n;return this},json(b){this.body=b;return this},end(){return this}};
  await handler({method,url:`/api/server/${resource}${method==='POST'?'':'/42'}`,query:{},headers:{},body:{title:'Synthetic edit',status:'todo'}},res);
  return {...f,code:res.code,body:res.body,list:JSON.parse(f.store[key]),item};
}
for(const configured of [true,false])test(`unlinked MOVES deletion rejects without mutation (configured=${configured})`,async()=>{
  const r=await invoke({linked:false,configured});assert.equal(r.code,409);assert.equal(r.body.code,'notion_link_required');
  assert.equal(r.body.notion_sync,'not_linked');assert.equal(r.calls,0);assert.equal(r.writes,0);assert.deepEqual(r.list,[r.item]);
});
test('MOVES without a KV target reject rather than claiming canonical deletion',async()=>{
  const r=await invoke({exists:false});assert.equal(r.code,409);assert.equal(r.body.code,'move_target_not_found');
  assert.equal(r.calls,0);assert.equal(r.writes,0);assert.deepEqual(r.list,[]);
});
test('absent supporting KV-only target retains idempotent success',async()=>{
  const r=await invoke({resource:'announcements',exists:false});assert.equal(r.code,200);
  assert.equal(r.calls,0);assert.deepEqual(r.list,[]);
});
test('canonical archive rejection preserves KV',async()=>{const r=await invoke();assert.equal(r.code,502);assert.equal(r.calls,1);assert.equal(r.writes,0);assert.deepEqual(r.list,[r.item])});
test('confirmed canonical archive removes KV copy after success',async()=>{const r=await invoke({providerOK:true});assert.equal(r.code,200);assert.equal(r.calls,1);assert.equal(r.writes,1);assert.deepEqual(r.list,[])});
test('supporting KV-only deletion retains existing behavior',async()=>{const r=await invoke({resource:'announcements',linked:false});assert.equal(r.code,200);assert.equal(r.calls,0);assert.equal(r.writes,1);assert.deepEqual(r.list,[])});
for(const method of ['POST','PUT','DELETE'])test(`${method} provider failure returns stable redacted diagnostic`,async()=>{
  const r=await invoke({method});assert.equal(r.code,502);assert.equal(r.writes,0);assert.equal(r.body.notion_error,'notion_write_failed');
  assert.doesNotMatch(JSON.stringify(r.body),/SYNTHETIC_PRIVATE_PROVIDER_DETAIL|11111111-1111-4111-8111-111111111111/);
});
test('client source contract awaits deletion confirmation before removal',async()=>{
  const s=await readFile(new URL('../src/contexts/DashboardContext.tsx',import.meta.url),'utf8');
  const start=s.indexOf('async deleteTask(id: number)');const action=s.slice(start,s.indexOf('// Stations',start));
  assert.match(action,/await api\.deleteTask\(id\);\s*setTasks\(prev => prev\.filter\(t => t\.id !== id\)\)/);
});
