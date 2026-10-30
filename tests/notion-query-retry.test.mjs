import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchSourceRows,
  queryCanonicalNotionDatabase,
} from '../api/_notion-sources.ts';

const response = (status, payload, headers = {}) => new Response(
  JSON.stringify(payload),
  { status, headers: { 'Content-Type': 'application/json', ...headers } },
);

const page = (id) => ({
  id,
  created_time: '2026-10-01T00:00:00.000Z',
  last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {},
});

async function withFetch(mock, run) {
  const originalFetch = globalThis.fetch;
  const originalRandom = Math.random;
  globalThis.fetch = mock;
  Math.random = () => 0;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    Math.random = originalRandom;
  }
}

test('canonical query retries a transient page failure and reuses the cursor', async () => {
  const calls = [];
  const pages = await withFetch(async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    if (calls.length === 1) {
      return response(200, {
        results: [page('synthetic-page-one')],
        has_more: true,
        next_cursor: 'synthetic-cursor',
      });
    }
    if (calls.length === 2) {
      return response(502, { message: 'synthetic upstream body' }, { 'Retry-After': '0' });
    }
    return response(200, {
      results: [page('synthetic-page-two')],
      has_more: false,
      next_cursor: null,
    });
  }, () => queryCanonicalNotionDatabase('moves', 'synthetic-db-id', 'synthetic-token'));

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].body, { page_size: 100, start_cursor: 'synthetic-cursor' });
  assert.deepEqual(calls[1].body, calls[2].body);
  assert.deepEqual(pages.map((entry) => entry.id), ['synthetic-page-one', 'synthetic-page-two']);
});

test('canonical query does not retry a non-transient 400 and does not expose the body or database ID', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    return response(400, { message: 'synthetic private response body' });
  }, async () => {
    await assert.rejects(
      queryCanonicalNotionDatabase('people', 'synthetic-db-id', 'synthetic-token'),
      (error) => {
        assert.match(error.message, /HTTP 400 after 1 attempt/);
        assert.doesNotMatch(error.message, /synthetic-db-id|synthetic private response body/);
        return true;
      },
    );
  });
  assert.equal(calls, 1);
});

test('canonical query stops after three transient HTTP attempts', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    return response(503, { message: 'synthetic upstream body' });
  }, async () => {
    await assert.rejects(
      queryCanonicalNotionDatabase('flows', 'synthetic-db-id', 'synthetic-token'),
      /HTTP 503 after 3 attempt\(s\)/,
    );
  });
  assert.equal(calls, 3);
});

test('canonical query does not retry sooner than a Retry-After beyond the bounded wait', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    return response(429, { message: 'synthetic rate limit body' }, { 'Retry-After': '30' });
  }, async () => {
    await assert.rejects(
      queryCanonicalNotionDatabase('content', 'synthetic-db-id', 'synthetic-token'),
      /HTTP 429 after 1 attempt/,
    );
  });
  assert.equal(calls, 1);
});

test('transient network failures retry for canonical sources', async () => {
  let calls = 0;
  const pages = await withFetch(async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('synthetic network failure');
    return response(200, { results: [page('synthetic-page')], has_more: false, next_cursor: null });
  }, () => queryCanonicalNotionDatabase('money', 'synthetic-db-id', 'synthetic-token'));

  assert.equal(calls, 2);
  assert.equal(pages[0].id, 'synthetic-page');
});

test('AbortError retries for canonical sources', async () => {
  let calls = 0;
  const pages = await withFetch(async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('synthetic abort');
      error.name = 'AbortError';
      throw error;
    }
    return response(200, { results: [page('synthetic-page')], has_more: false, next_cursor: null });
  }, () => queryCanonicalNotionDatabase('moves', 'synthetic-db-id', 'synthetic-token'));

  assert.equal(calls, 2);
  assert.equal(pages[0].id, 'synthetic-page');
});

test('malformed Retry-After falls back to the bounded retry delay', async () => {
  let calls = 0;
  const pages = await withFetch(async () => {
    calls += 1;
    if (calls === 1) {
      return response(429, { message: 'synthetic rate limit' }, { 'Retry-After': 'not-a-date' });
    }
    return response(200, { results: [page('synthetic-page')], has_more: false, next_cursor: null });
  }, () => queryCanonicalNotionDatabase('people', 'synthetic-db-id', 'synthetic-token'));

  assert.equal(calls, 2);
  assert.equal(pages[0].id, 'synthetic-page');
});

test('canonical query retries HTTP 408, 429, 500, and 504', async () => {
  for (const status of [408, 429, 500, 504]) {
    let calls = 0;
    const pages = await withFetch(async () => {
      calls += 1;
      if (calls === 1) return response(status, { message: 'synthetic transient response' });
      return response(200, { results: [page(`synthetic-${status}`)], has_more: false, next_cursor: null });
    }, () => queryCanonicalNotionDatabase('flows', 'synthetic-db-id', 'synthetic-token'));

    assert.equal(calls, 2, `HTTP ${status} should retry once`);
    assert.equal(pages[0].id, `synthetic-${status}`);
  }
});

test('optional feedback source remains single-attempt', async () => {
  const previous = process.env.NOTION_DB_FEEDBACK;
  process.env.NOTION_DB_FEEDBACK = 'synthetic-feedback-db';
  let calls = 0;
  try {
    await withFetch(async () => {
      calls += 1;
      return response(502, { message: 'synthetic upstream body' });
    }, async () => {
      await assert.rejects(
        fetchSourceRows('feedback', 'synthetic-token'),
        /HTTP 502 after 1 attempt/,
      );
    });
  } finally {
    if (previous === undefined) delete process.env.NOTION_DB_FEEDBACK;
    else process.env.NOTION_DB_FEEDBACK = previous;
  }
  assert.equal(calls, 1);
});

test('dashboard wires retry only to the five canonical Notion sources', async () => {
  const { readFile } = await import('node:fs/promises');
  const dashboard = await readFile(new URL('../api/dashboard.ts', import.meta.url), 'utf8');

  for (const source of ['moves', 'people', 'flows', 'content', 'money']) {
    assert.match(dashboard, new RegExp(`queryCanonicalNotionDatabase\\('${source}'`));
  }
  for (const variable of ['dbOpenAsks', 'dbEvents', 'dbFeedback']) {
    assert.match(dashboard, new RegExp(`queryNotionDatabase\\(${variable}, secret\\)`));
    assert.doesNotMatch(dashboard, new RegExp(`queryCanonicalNotionDatabase\\('${variable.replace(/^db/, '').toLowerCase()}'`));
  }
});
