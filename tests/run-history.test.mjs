import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSyncRunsPayload,
  runStatusTone,
  runStartedDate,
  formatDurationMs,
  runDetailLine,
} from "../src/lib/runHistory.ts";

const RUN = {
  id: 7,
  started_at: "2026-11-01T18:14:03.000Z",
  finished_at: "2026-11-01T18:14:44.000Z",
  trigger: "webhook",
  status: "partial",
  sources: [
    { source: "people", rows: 28, cached: false },
    { source: "moves", rows: 15, cached: true },
    { source: "money", rows: 2, cached: false, error: "timeout" },
  ],
  total_rows: 214,
  duration_ms: 41000,
  deferred_sources: ["feedback"],
};

test("parse: a well-formed payload maps snake_case rows to summaries", () => {
  const read = parseSyncRunsPayload({ runs: [RUN], store: "sync_runs" });
  assert.equal(read.store, "sync_runs");
  assert.equal(read.runs.length, 1);
  const run = read.runs[0];
  assert.equal(run.startedAt, RUN.started_at);
  assert.equal(run.trigger, "webhook");
  assert.equal(run.status, "partial");
  assert.equal(run.totalRows, 214);
  assert.equal(run.durationMs, 41000);
  assert.equal(run.sources.length, 3);
  assert.equal(run.sources[2].error, "timeout");
  assert.deepEqual(run.deferredSources, ["feedback"]);
});

test("parse: an empty store is a successful read, not null", () => {
  const read = parseSyncRunsPayload({ runs: [], store: "unconfigured" });
  assert.deepEqual(read, { runs: [], store: "unconfigured" });
});

test("parse: malformed payloads return null", () => {
  assert.equal(parseSyncRunsPayload(null), null);
  assert.equal(parseSyncRunsPayload("runs"), null);
  assert.equal(parseSyncRunsPayload({}), null);
  assert.equal(parseSyncRunsPayload({ runs: "nope" }), null);
});

test("parse: junk entries drop out, good rows survive", () => {
  const read = parseSyncRunsPayload({
    runs: [null, 42, { started_at: "" }, RUN],
    store: "sync_runs",
  });
  assert.equal(read.runs.length, 1);
  assert.equal(read.runs[0].totalRows, 214);
});

test("parse: missing optional fields degrade, never throw", () => {
  const read = parseSyncRunsPayload({
    runs: [{ started_at: "2026-11-01T00:00:00.000Z" }],
  });
  const run = read.runs[0];
  assert.equal(run.trigger, "unknown");
  assert.equal(run.status, "unknown");
  assert.equal(run.totalRows, 0);
  assert.equal(run.durationMs, null);
  assert.deepEqual(run.sources, []);
  assert.equal(read.store, "unknown");
});

test("tone: engine statuses map to the HealthRow vocabulary", () => {
  assert.equal(runStatusTone("ok"), "ok");
  assert.equal(runStatusTone("partial"), "warn");
  assert.equal(runStatusTone("failed"), "error");
  assert.equal(runStatusTone("anything-else"), "neutral");
});

test("started date: parseable timestamps give a Date, junk gives null", () => {
  const read = parseSyncRunsPayload({ runs: [RUN], store: "sync_runs" });
  const date = runStartedDate(read.runs[0]);
  assert.equal(date.toISOString(), RUN.started_at);
  const junk = parseSyncRunsPayload({
    runs: [{ started_at: "not-a-date" }],
  });
  assert.equal(runStartedDate(junk.runs[0]), null);
});

test("duration: sub-second, seconds, and minutes forms", () => {
  assert.equal(formatDurationMs(null), "");
  assert.equal(formatDurationMs(850), "850ms");
  assert.equal(formatDurationMs(41000), "41s");
  assert.equal(formatDurationMs(125000), "2m 5s");
  assert.equal(formatDurationMs(120000), "2m");
});

test("detail line: rows, sources, duration, deferred and errors named", () => {
  const read = parseSyncRunsPayload({ runs: [RUN], store: "sync_runs" });
  assert.equal(
    runDetailLine(read.runs[0]),
    "214 rows · 3 sources · 41s · deferred: feedback · errors: money",
  );
});

test("detail line: a clean short run stays short", () => {
  const read = parseSyncRunsPayload({
    runs: [
      {
        started_at: "2026-11-01T00:00:00.000Z",
        status: "ok",
        sources: [{ source: "people", rows: 28, cached: false }],
        total_rows: 28,
        duration_ms: 900,
        deferred_sources: [],
      },
    ],
  });
  assert.equal(runDetailLine(read.runs[0]), "28 rows · 1 source · 900ms");
});
