import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';

const moduleURL = code => `data:text/javascript,${encodeURIComponent(code)}`;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@supabase/supabase-js') return {
    shortCircuit: true,
    url: moduleURL(`export function createClient(){return {auth:{async getUser(){return {data:{user:{id:'synthetic-user',role:'authenticated'}},error:null}}}}}`),
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_auth.js') return {
    shortCircuit: true,
    url: new URL('../api/_auth.ts', import.meta.url).href,
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './_dashboard-auth.js') return {
    shortCircuit: true,
    url: new URL('../api/_dashboard-auth.ts', import.meta.url).href,
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './workspaceSync.js') return {
    shortCircuit: true,
    url: moduleURL(`
      export async function syncWorkspaceToDatabase(){globalThis.__workspaceSyncFixture.calls++;return {status:'ok'}}
      export function appendCheckinToWorkspace(){}
      export function appendWellNoteToWorkspace(){}
      export function canonicalCheckinHash(){return 'synthetic'}
      export function canonicalNoteHash(){return 'synthetic'}
      export function updateWellNoteInWorkspace(){}
    `),
  };
  if (context.parentURL?.endsWith('/api/server.ts') && specifier === './notionWriter.js') return {
    shortCircuit: true,
    url: moduleURL(`
      export const NOTION_RESOURCES = {}
      export async function notionCreate(){}
      export async function notionUpdate(){}
      export async function notionArchive(){}
    `),
  };
  return next(specifier, context);
}});

const { default: handler } = await import('../api/server.ts');
const savedEnv = Object.fromEntries(['CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'].map(key => [key, process.env[key]]));
after(() => {
  hooks.deregister();
  delete globalThis.__workspaceSyncFixture;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
    send(body) { this.body = body; return this; },
  };
}

async function invoke(authorization) {
  const res = response();
  await handler({
    method: 'POST',
    url: '/api/server/workspace-sync',
    query: {},
    headers: { authorization },
    body: {},
  }, res);
  return res;
}

test('workspace-sync accepts the configured cron bearer and rejects user-only access', async () => {
  process.env.CRON_SECRET = 'synthetic-cron-secret';
  process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'synthetic-anon-key';
  globalThis.__workspaceSyncFixture = { calls: 0 };

  const cronResponse = await invoke('Bearer synthetic-cron-secret');
  assert.equal(cronResponse.statusCode, 200);
  assert.deepEqual(cronResponse.body, { status: 'ok' });
  assert.equal(globalThis.__workspaceSyncFixture.calls, 1);

  const userResponse = await invoke('Bearer x.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.x');
  assert.equal(userResponse.statusCode, 401);
  assert.equal(globalThis.__workspaceSyncFixture.calls, 1);

  delete process.env.CRON_SECRET;
  const unconfiguredResponse = await invoke('Bearer x.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.x');
  assert.equal(unconfiguredResponse.statusCode, 503);
  assert.equal(globalThis.__workspaceSyncFixture.calls, 1);
});
