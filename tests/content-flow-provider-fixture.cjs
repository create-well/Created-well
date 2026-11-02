// Bundles only a mocked local provider + the actual MovesPage for browser tests.
// The stubbed API makes no network requests and no live writes.
const {build}=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'..');
const out=process.env.CW_FIXTURE_DIR || '/data/cw-relation-mounted-fixture';
fs.mkdirSync(out,{recursive:true});
const entry=`import React from 'react'; import {createRoot} from 'react-dom/client';
 import {DashboardProvider} from './src/contexts/DashboardContext';
 import {MovesPage} from './src/app/pages/MovesPage';
 import {useDashboard} from './src/contexts/DashboardContext';
 function Inspect(){const {data,actions}=useDashboard(); return <div><span id="sync-state">{data.syncStatus}</span><span id="content-state">{data.canonicalSourceStatuses.content}</span><span id="forum-count">{data.forum.length}</span><button type="button" onClick={actions.retrySync}>Fixture retry</button></div>}
 createRoot(document.getElementById('root')).render(<DashboardProvider onSignOut={async()=>{}}><Inspect/><MovesPage/></DashboardProvider>);`;
const mocks={
 api:`export const isDashboardAvailable=true; export async function fetchDashboard(){globalThis.__calls++; if(globalThis.__throw) throw Error('synthetic primary failure'); return globalThis.__payload;} export async function sync(){return globalThis.__fallback;} export function updateForumPost(){return new Promise(()=>{});} export function deleteForumPost(){return new Promise(()=>{});} export function sendMessage(){return new Promise(()=>{});}`,
 auth:`export const getStoredProfile=()=>null;`,
 welcome:`export const shouldShowOnboarding=()=>false;`,
 router:`export const useNavigate=()=>()=>{};`,
 geyser:`import React from 'react'; export function GeyserView(p){return <section><button type="button" onClick={()=>p.onUpdateForumPost(0x1234567,{content:'optimistic edit'})}>Fixture optimistic edit</button><button type="button" onClick={()=>p.onDeleteForumPost(0x1234567)}>Fixture optimistic delete</button><span id="forum-values">{p.forum.map(x=>x.content).join('|')}</span></section>}`,
 modal:`import React from 'react'; export const AddTaskModal=()=>null;`,
};
const plugin={name:'isolate-fixture',setup(b){
 b.onResolve({filter:/.*/},args=>{
  const importer=args.importer;
  let key;
  if(importer.endsWith('/DashboardContext.tsx') && args.path==='../app/components/api') key='api';
  if(importer.endsWith('/DashboardContext.tsx') && args.path.endsWith('/AuthGate')) key='auth';
  if(importer.endsWith('/DashboardContext.tsx') && args.path.endsWith('/WelcomeModal')) key='welcome';
  if(importer.endsWith('/MovesPage.tsx') && args.path==='react-router') key='router';
  if(importer.endsWith('/MovesPage.tsx') && args.path.endsWith('/GeyserView')) key='geyser';
  if(importer.endsWith('/MovesPage.tsx') && args.path.endsWith('/AddTaskModal')) key='modal';
  return key?{path:key,namespace:'mock'}:undefined;
 });
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'jsx',resolveDir:repo}));
}};
build({stdin:{contents:entry,resolveDir:repo,loader:'tsx'},bundle:true,platform:'browser',format:'iife',plugins:[plugin],outfile:out+'/bundle.js',logLevel:'silent'}).then(()=>{
 fs.writeFileSync(out+'/index.html',`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>
 const flow='11111111-1111-4111-8111-111111111111';
 const forum=['12345670-0000-4000-8000-000000000001','12345670-0000-4000-8000-000000000002'].map((id,i)=>({id:0x1234567,notionPageId:id,content:i?'Beta':'Alpha',flowRelation:{ids:[flow],complete:true}}));
 const base={tasks:[],stations:[],forum,messages:[],braindumps:[],announcements:[],forumReplies:[],workshops:[],workshopPrograms:[],workshopResources:[],coflowDates:[],coflowCheckins:[],wellNotes:[]};
 window.__calls=0; window.__good={...base,sourceErrors:{},contentQueryComplete:true};
 window.__bad={...base,forum:[],sourceErrors:{content:'synthetic private failure'},contentQueryComplete:false};
 window.__partial={...base,sourceErrors:{},contentQueryComplete:false}; window.__empty={...base,forum:[],sourceErrors:{},contentQueryComplete:true}; window.__fallback=base; window.__throw=false; window.__payload=window.__bad;
 </script><script src="./bundle.js"></script>`);
 console.log('Synthetic isolated provider fixture bundled');
}).catch(e=>{console.error(e);process.exitCode=1});
