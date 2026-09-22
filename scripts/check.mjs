import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';

const failures = [];
const read = async (path) => {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    failures.push(`${path}: ${error.code === 'ENOENT' ? 'missing' : error.message}`);
    return '';
  }
};
const requireFile = async (path) => {
  try {
    await access(path);
  } catch {
    failures.push(`${path}: missing`);
  }
};
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const path of [
  'api/server.ts',
  'api/server/[[...path]].ts',
  'api/dashboard.ts',
  'api/notionWriter.ts',
  'src/config/env.ts',
  'src/config/notion.ts',
  'src/config/sync.ts',
  '.env.local.example',
]) await requireFile(path);

const server = await read('api/server.ts');
const catchAll = await read('api/server/[[...path]].ts');
const dashboard = await read('api/dashboard.ts');
const notionWriter = await read('api/notionWriter.ts');
const configNotion = await read('src/config/notion.ts');
const configSync = await read('src/config/sync.ts');
const envExample = await read('.env.local.example');

assert(server.includes('export default async function handler'), 'api/server.ts must own the route handler');
assert(catchAll.trim() === "export { default } from '../server.js';", 'api/server/[[...path]].ts must remain a thin delegate');
assert(server.includes("import { KV_TABLE } from '../src/config/sync.js'"), 'api/server.ts must import the canonical KV table');
assert(server.includes('const TABLE = KV_TABLE'), 'api/server.ts must bind its table through centralized config');
assert(![server, dashboard, notionWriter].some((source) => source.includes('kv_store_8dcd9693')), 'deprecated KV table identifier found in API runtime files');
assert(dashboard.includes('from( KV_TABLE'.replace(' ', '')), 'api/dashboard.ts must use the canonical KV table');
assert(configSync.includes("KV_TABLE = 'kv_store_dabe1c74'"), 'sync config must own the canonical KV table');
assert(dashboard.includes('SYNC_POLICY.CACHE_TTL_MS'), 'api/dashboard.ts must retain its bounded process cache TTL');
assert(dashboard.includes("getNotionDb('PEOPLE')"), 'api/dashboard.ts must resolve Notion mappings centrally');
assert(configNotion.includes('NOTION_DB_ENV_KEYS'), 'Notion config must expose the canonical environment mapping');
for (const envKey of ['NOTION_SECRET', 'NOTION_DB_MOVES', 'NOTION_DB_PEOPLE', 'NOTION_DB_FLOWS', 'NOTION_DB_CONTENT', 'SUPABASE_SERVICE_ROLE_KEY']) {
  assert(envExample.includes(`${envKey}=`), `.env.local.example must document ${envKey}`);
}
assert(!envExample.match(/SUPABASE_SERVICE_ROLE_KEY=(?!your_service_role_key_here$).+/m), '.env.local.example must not contain a real service-role key');

if (failures.length) {
  console.error('Created Well check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Created Well check passed: API topology, KV boundary, env template, and cache guards are healthy.');
}
