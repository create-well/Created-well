import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('API consumers use the canonical KV and Notion configuration boundary', async () => {
  const [server, dashboard, writer, sync, notion] = await Promise.all([
    read('api/server.ts'),
    read('api/dashboard.ts'),
    read('api/notionWriter.ts'),
    read('src/config/sync.ts'),
    read('src/config/notion.ts'),
  ]);
  assert.match(server, /import \{ KV_TABLE \} from ['"]\.\.\/src\/config\/sync\.js['"]/);
  assert.match(server, /const TABLE = KV_TABLE/);
  assert.match(server, /getNotionDb\(cfg\.dbKey\)/);
  assert.match(dashboard, /import \{ getNotionDb \} from ['"]\.\.\/src\/config\/notion\.js['"]/);
  assert.match(dashboard, /from\(KV_TABLE\)/);
  assert.match(writer, /dbKey:.*'PEOPLE'/);
  assert.match(sync, /kv_store_dabe1c74/);
  assert.match(notion, /NOTION_DB_ENV_KEYS/);
  assert.doesNotMatch(`${server}\n${dashboard}`, /kv_store_8dcd9693/);
});

test('DashboardContext retry restarts polling and exposes a useful error', async () => {
  const context = await read('src/contexts/DashboardContext.tsx');
  const types = await read('src/types/dashboard.ts');
  assert.match(context, /useState<string \| null>\(null\)/);
  assert.match(context, /setRetryNonce\(value => value \+ 1\)/);
  assert.match(context, /\}, \[retryNonce\]\);/);
  assert.match(context, /setSyncError\(/);
  assert.match(types, /syncError: string \| null/);
});

test('Care page includes a read-only People & Pathways registry', async () => {
  const [page, registry] = await Promise.all([
    read('src/app/pages/CarePage.tsx'),
    read('src/app/components/CarePeopleRegistry.tsx'),
  ]);
  assert.match(page, /<CarePeopleRegistry people=\{data\.stations\}/);
  assert.match(registry, /Read-only prototype/);
  assert.match(registry, /aria-labelledby="care-people-registry-title"/);
  assert.match(registry, /setExpandedId/);
});

test('local environment defaults do not enable authentication bypass', async () => {
  const env = await read('.env.local.example');
  const packageJson = await read('package.json');
  assert.match(env, /^VITE_DEV_BYPASS=false$/m);
  assert.match(packageJson, /check:secrets/);
});
