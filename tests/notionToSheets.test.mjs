import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { googleAccessToken, main, writeSheets } from '../scripts/notion-to-sheets.mjs';

const originalFetch = global.fetch;

function decodeJwtPayload(assertion) {
  const [, payload] = assertion.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function createEnv(overrides = {}) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    NOTION_TOKEN: 'notion-token',
    NOTION_DATA_SOURCE_ID: 'collection://source-id',
    GOOGLE_SHEET_ID: 'sheet-id',
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: 'service-account@example.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    }),
    REVENUE_RANGE: 'Revenue_Ops!A2:T',
    BACKUP_RANGE: 'Backup_Log!A2:J',
    SYNC_OWNER: 'owner@example.com',
    ...overrides,
  };
}

test('writeSheets retries with owner impersonation after a permission-denied response', async (t) => {
  t.after(() => {
    global.fetch = originalFetch;
  });

  const env = createEnv();
  const tokenPayloads = [];
  let writeAttempts = 0;

  global.fetch = async (url, options = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      const payload = decodeJwtPayload(options.body.get('assertion'));
      tokenPayloads.push(payload);
      return new Response(JSON.stringify({ access_token: `token-${tokenPayloads.length}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values:batchUpdate`) {
      writeAttempts += 1;
      assert.equal(options.headers.Authorization, 'B' + 'earer token-' + writeAttempts);
      if (writeAttempts === 1) {
        return new Response(JSON.stringify({ error: { message: 'The caller does not have permission' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ updatedRange: env.REVENUE_RANGE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  };

  const result = await writeSheets([['row']], [['backup']], env);

  assert.equal(result.updatedRange, env.REVENUE_RANGE);
  assert.equal(tokenPayloads.length, 2);
  assert.equal(tokenPayloads[0].sub, undefined);
  assert.equal(tokenPayloads[1].sub, env.SYNC_OWNER);
});

test('googleAccessToken rejects a mismatched expected service-account identity', async () => {
  const env = createEnv({ EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL: 'expected@example.com' });
  await assert.rejects(
    () => googleAccessToken(env),
    /Google service-account identity mismatch: expected expected@example.com, received service-account@example.com/,
  );
});

test('main paginates Notion results and writes stable record keys to both ranges', async (t) => {
  t.after(() => {
    global.fetch = originalFetch;
  });

  const env = createEnv({ DRY_RUN: '0', EXPECTED_GOOGLE_SERVICE_ACCOUNT_EMAIL: 'service-account@example.com' });
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'service-account@example.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  let notionCalls = 0;
  let writeBody;

  global.fetch = async (url, options = {}) => {
    if (url.includes('/v1/data_sources/source-id/query')) {
      notionCalls += 1;
      const payload = notionCalls === 1
        ? { results: [{ id: '11111111-1111-1111-1111-111111111111', url: 'https://notion.so/one', properties: { Organization: { type: 'title', title: [{ plain_text: 'One' }] }, Owner: { type: 'select', select: { name: 'Monny' } }, Type: { type: 'select', select: { name: 'grant' } }, Currency: { type: 'select', select: { name: 'USD' } }, 'Sync Status': { type: 'select', select: { name: 'Pending' } }, Stage: { type: 'select', select: { name: 'prospect' } } } }], has_more: true, next_cursor: 'next' }
        : { results: [{ id: '22222222-2222-2222-2222-222222222222', url: 'https://notion.so/two', properties: { Organization: { type: 'title', title: [{ plain_text: 'Two' }] }, Owner: { type: 'select', select: { name: 'Monny' } }, Type: { type: 'select', select: { name: 'sponsor' } }, Currency: { type: 'select', select: { name: 'USD' } }, 'Sync Status': { type: 'select', select: { name: 'Pending' } }, Stage: { type: 'select', select: { name: 'pitched' } } } }], has_more: false }
      return new Response(JSON.stringify(payload), { status: 200 });
    }
    if (url === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'token' }), { status: 200 });
    if (url.includes('/values:batchUpdate')) {
      writeBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ updatedRange: env.REVENUE_RANGE }), { status: 200 });
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  };

  await main(env);
  assert.equal(notionCalls, 2);
  assert.equal(writeBody.data[0].values.length, 2);
  assert.equal(writeBody.data[0].values[0][0], '11111111-1111-1111-1111-111111111111');
  assert.equal(writeBody.data[0].values[0][16], 'rev_11111111111111111111111111111111');
  assert.equal(writeBody.data[1].values[0][4], 'rev_11111111111111111111111111111111');
});

test('writeSheets surfaces the original 403 when no owner impersonation is configured', async (t) => {
  t.after(() => {
    global.fetch = originalFetch;
  });

  const env = createEnv({ SYNC_OWNER: '' });
  const tokenPayloads = [];

  global.fetch = async (url, options = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      tokenPayloads.push(decodeJwtPayload(options.body.get('assertion')));
      return new Response(JSON.stringify({ access_token: 'token-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values:batchUpdate`) {
      return new Response('permission denied', { status: 403 });
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  };

  await assert.rejects(
    () => writeSheets([['row']], [['backup']], env),
    /Google Sheets write failed: 403 permission denied/,
  );
  assert.equal(tokenPayloads.length, 1);
  assert.equal(tokenPayloads[0].sub, undefined);
});
