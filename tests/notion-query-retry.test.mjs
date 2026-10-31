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
      return response(504, { message: 'synthetic upstream body' }, { 'Retry-After': '0' });
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

test('canonical query rejects a noncanonical runtime source before fetch', async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    return response(200, { results: [], has_more: false, next_cursor: null });
  }, async () => {
    await assert.rejects(
      queryCanonicalNotionDatabase('feedback', 'synthetic-db-id', 'synthetic-token'),
      /canonical sources only/,
    );
  });
  assert.equal(calls, 0);
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
    return response(504, { message: 'synthetic upstream body' });
  }, async () => {
    await assert.rejects(
      queryCanonicalNotionDatabase('flows', 'synthetic-db-id', 'synthetic-token'),
      /HTTP 504 after 3 attempt\(s\)/,
    );
  });
  assert.equal(calls, 3);

  for (const status of [502, 503]) {
    let excludedStatusCalls = 0;
    await withFetch(async () => {
      excludedStatusCalls += 1;
      return response(status, { message: 'synthetic upstream body' });
    }, async () => {
      await assert.rejects(
        queryCanonicalNotionDatabase('flows', 'synthetic-db-id', 'synthetic-token'),
        new RegExp(`HTTP ${status} after 1 attempt`),
      );
    });
    assert.equal(excludedStatusCalls, 1, `HTTP ${status} must not retry`);
  }
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

test('TimeoutError retries for canonical sources', async () => {
  let calls = 0;
  const pages = await withFetch(async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('synthetic timeout');
      error.name = 'TimeoutError';
      throw error;
    }
    return response(200, { results: [page('synthetic-page')], has_more: false, next_cursor: null });
  }, () => queryCanonicalNotionDatabase('money', 'synthetic-db-id', 'synthetic-token'));

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

test('valid HTTP-date Retry-After uses the bounded server delay', async () => {
  const originalNow = Date.now;
  const originalSetTimeout = globalThis.setTimeout;
  const fixedNow = Date.UTC(2026, 9, 30, 12, 0, 0);
  let observedDelay;
  let calls = 0;
  Date.now = () => fixedNow;
  globalThis.setTimeout = (callback, delay, ...args) => {
    observedDelay = delay;
    return originalSetTimeout(callback, 0, ...args);
  };
  try {
    const retryAfter = new Date(fixedNow + 1_000).toUTCString();
    const pages = await withFetch(async () => {
      calls += 1;
      if (calls === 1) {
        return response(429, { message: 'synthetic rate limit' }, { 'Retry-After': retryAfter });
      }
      return response(200, { results: [page('synthetic-page')], has_more: false, next_cursor: null });
    }, () => queryCanonicalNotionDatabase('people', 'synthetic-db-id', 'synthetic-token'));

    assert.equal(calls, 2);
    assert.equal(pages[0].id, 'synthetic-page');
  } finally {
    Date.now = originalNow;
    globalThis.setTimeout = originalSetTimeout;
  }
  assert.equal(observedDelay, 1_000);
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

test('fetchSourceRows retries canonical pages and follows the cursor', async () => {
  const previous = process.env.NOTION_DB_MONEY;
  process.env.NOTION_DB_MONEY = 'synthetic-money-db';
  const calls = [];
  try {
    const rows = await withFetch(async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
      if (calls.length < 3) return response(504, { message: 'synthetic retry' });
      if (calls.length === 3) {
        return response(200, {
          results: [page('synthetic-money-one')],
          has_more: true,
          next_cursor: 'synthetic-money-cursor',
        });
      }
      return response(200, {
        results: [
          page('synthetic-money-two'),
          { id: 'synthetic-empty-properties', last_edited_time: 42, properties: null },
          { id: null, last_edited_time: '2026-10-01T00:00:00.000Z', properties: {} },
        ],
        has_more: false,
        next_cursor: null,
      });
    }, () => fetchSourceRows('money', 'synthetic-token'));

    assert.equal(calls.length, 4);
    assert.deepEqual(calls[0].body, { page_size: 100 });
    assert.deepEqual(calls[0].body, calls[1].body);
    assert.deepEqual(calls[1].body, calls[2].body);
    assert.deepEqual(calls[3].body, { page_size: 100, start_cursor: 'synthetic-money-cursor' });
    assert.deepEqual(rows.map((row) => row._id), [
      'synthetic-money-one',
      'synthetic-money-two',
      'synthetic-empty-properties',
    ]);
    assert.equal(rows[2]._last_edited, null);
    assert.deepEqual(rows[2].properties, {});
  } finally {
    if (previous === undefined) delete process.env.NOTION_DB_MONEY;
    else process.env.NOTION_DB_MONEY = previous;
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
