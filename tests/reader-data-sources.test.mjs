// Reader migration (2026-11-02): the reader resolves each database's
// data source id and queries the data_sources route on
// Notion-Version 2025-09-03. The legacy /v1/databases/{id}/query route
// (2022-06-28) must never be called. No real network: synthetic stubs.

import test from "node:test";
import assert from "node:assert/strict";

process.env.SYNC_TEST_SEAMS = "1";

const {
  queryCanonicalNotionDatabase,
  resolveDataSourceId,
  resetDataSourceIdCache,
} = await import("../api/_notion-sources.ts");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    body: { cancel: async () => {} },
  };
}

async function withFetch(mock, run) {
  const originalFetch = globalThis.fetch;
  resetDataSourceIdCache();
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    resetDataSourceIdCache();
  }
}

test("canonical query resolves the data source and queries the data_sources route on 2025-09-03", async () => {
  const calls = [];
  const pages = await withFetch(async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", version: init?.headers?.["Notion-Version"] });
    if (String(url).endsWith("/v1/databases/db-one")) {
      return response(200, { data_sources: [{ id: "ds-one" }] });
    }
    return response(200, { results: [{ id: "page-1", properties: {} }], has_more: false, next_cursor: null });
  }, () => queryCanonicalNotionDatabase("moves", "db-one", "synthetic-secret"));

  assert.equal(pages.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].version, "2025-09-03");
  assert.equal(calls[1].url, "https://api.notion.com/v1/data_sources/ds-one/query");
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].version, "2025-09-03");
  assert.ok(!calls.some((c) => c.url.includes("/databases/") && c.url.endsWith("/query")), "the legacy route is never called");
});

test("resolution is cached per database: a second query pays no second GET", async () => {
  let gets = 0;
  let posts = 0;
  await withFetch(async (url) => {
    if (String(url).endsWith("/v1/databases/db-two")) {
      gets += 1;
      return response(200, { data_sources: [{ id: "ds-two" }] });
    }
    posts += 1;
    return response(200, { results: [], has_more: false, next_cursor: null });
  }, async () => {
    await queryCanonicalNotionDatabase("moves", "db-two", "synthetic-secret");
    await queryCanonicalNotionDatabase("moves", "db-two", "synthetic-secret");
  });
  assert.equal(gets, 1);
  assert.equal(posts, 2);
});

test("a database with no data sources fails closed and never falls back to the legacy route", async () => {
  const calls = [];
  await withFetch(async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return response(200, { data_sources: [] });
  }, async () => {
    await assert.rejects(
      () => queryCanonicalNotionDatabase("moves", "db-empty", "synthetic-secret"),
      /returned no data sources/,
    );
  });
  assert.ok(!calls.some((c) => c.method === "POST"), "no query was attempted");
});

test("a multi-source database resolves to its first data source", async () => {
  const queried = [];
  await withFetch(async (url) => {
    if (String(url).endsWith("/v1/databases/db-multi")) {
      return response(200, { data_sources: [{ id: "ds-first" }, { id: "ds-second" }] });
    }
    queried.push(String(url));
    return response(200, { results: [], has_more: false, next_cursor: null });
  }, () => queryCanonicalNotionDatabase("moves", "db-multi", "synthetic-secret"));
  assert.deepEqual(queried, ["https://api.notion.com/v1/data_sources/ds-first/query"]);
});

test("a failed resolution is not cached: the next call retries the GET", async () => {
  let gets = 0;
  await withFetch(async (url) => {
    if (String(url).endsWith("/v1/databases/db-flaky")) {
      gets += 1;
      if (gets === 1) return response(404, "not found (fixture)");
      return response(200, { data_sources: [{ id: "ds-flaky" }] });
    }
    return response(200, { results: [], has_more: false, next_cursor: null });
  }, async () => {
    await assert.rejects(() => resolveDataSourceId("db-flaky", "synthetic-secret"), /404/);
    const id = await resolveDataSourceId("db-flaky", "synthetic-secret");
    assert.equal(id, "ds-flaky");
    assert.equal(gets, 2);
  });
});
