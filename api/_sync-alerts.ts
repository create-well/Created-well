// Live-sync alert lines (rev3 item 10; Leg F of the rev3 correction
// packet). Passive-only failure visibility is rejected by the spec:
// the reconcile pass that finds any of these conditions writes them
// as alert entries in its own run record (the sources jsonb carries
// them, no DDL) and logs one console line per alert. The morning
// brief is the consumer; it reads sync_runs, it is not built here.
//
// The four conditions:
// - a non-zero error-run count since the last reconcile pass;
// - webhook silence longer than two cron intervals on a source that
//   previously delivered (an ok sync exists and events used to land);
// - an expired claim at pass start — until Leg B lands claim_state,
//   the lease expiry stands in for the claim, per the packet;
// - an uncleared setup row (the webhook verification token stash)
//   older than 24 hours.
// Plus the rev3.1 item 5c refinement: a rejected handshake is
// expected noise and is NOT an alert unless it repeats; handshake-
// only error runs are therefore excluded from the error-run count
// and counted on their own channel, alerting at two or more.

import { CRON_INTERVAL_MS } from "./_sync-engine.js";
import type { DeliveryState } from "./_supabase.js";

export const SETUP_ROW_MAX_AGE_MS = 24 * 60 * 60_000;

export interface SyncRunSummary {
  started_at: string;
  status: string;
  trigger: string;
  sources: unknown;
}

export interface AlertInputs {
  now: number;
  // Recent run history, newest first, EXCLUDING the current pass
  // (the caller computes alerts before recording its own run).
  runs: SyncRunSummary[];
  states: Array<{
    source: string;
    state: DeliveryState | null;
    leaseExpiresAt: string | null;
  }>;
  setupUpdatedAt: string | null;
}

function errorEntries(run: SyncRunSummary): Array<{ error?: unknown }> {
  if (!Array.isArray(run.sources)) return [];
  return run.sources.filter(
    (entry): entry is { error?: unknown } =>
      typeof entry === "object" && entry !== null,
  );
}

function isHandshakeOnlyFailure(run: SyncRunSummary): boolean {
  if (run.status === "ok") return false;
  const errored = errorEntries(run).filter(
    (entry) => typeof entry.error === "string",
  );
  return (
    errored.length > 0 &&
    errored.every(
      (entry) =>
        typeof entry.error === "string" &&
        entry.error.startsWith("handshake rejected"),
    )
  );
}

function handshakeRejections(run: SyncRunSummary): number {
  return errorEntries(run).filter(
    (entry) =>
      typeof entry.error === "string" &&
      entry.error.startsWith("handshake rejected"),
  ).length;
}

export function computeSyncAlerts(inputs: AlertInputs): string[] {
  const alerts: string[] = [];
  const { now, runs } = inputs;

  // The window opens at the previous reconcile pass. Runs are newest
  // first and exclude the current pass, so the first reconcile run
  // in the list is the previous pass; with none, the window is the
  // whole list.
  const previousPass = runs.find((run) => run.trigger === "reconcile");
  const windowStart = previousPass
    ? Date.parse(previousPass.started_at)
    : NaN;
  const sinceLastPass = runs.filter((run) => {
    if (!Number.isFinite(windowStart)) return true;
    return Date.parse(run.started_at) > windowStart;
  });

  const errorRuns = sinceLastPass.filter(
    (run) => run.status !== "ok" && !isHandshakeOnlyFailure(run),
  );
  if (errorRuns.length > 0) {
    alerts.push(
      `error runs since last reconcile pass: ${errorRuns.length}`,
    );
  }

  const rejections = sinceLastPass.reduce(
    (sum, run) => sum + handshakeRejections(run),
    0,
  );
  if (rejections >= 2) {
    alerts.push(
      `repeated handshake rejections since last reconcile pass: ${rejections}`,
    );
  }

  for (const { source, state, leaseExpiresAt } of inputs.states) {
    if (
      leaseExpiresAt &&
      Number.isFinite(Date.parse(leaseExpiresAt)) &&
      Date.parse(leaseExpiresAt) < now
    ) {
      alerts.push(
        `expired claim: ${source} (lease expired at ${leaseExpiresAt})`,
      );
    }
    if (state?.last_sync_ok_at && state.last_event_at) {
      const silenceMs = now - Date.parse(state.last_event_at);
      if (
        Number.isFinite(silenceMs) &&
        silenceMs > 2 * CRON_INTERVAL_MS
      ) {
        alerts.push(
          `webhook silence: ${source} last event at ${state.last_event_at} (older than two intervals)`,
        );
      }
    }
  }

  if (inputs.setupUpdatedAt) {
    const ageMs = now - Date.parse(inputs.setupUpdatedAt);
    if (Number.isFinite(ageMs) && ageMs > SETUP_ROW_MAX_AGE_MS) {
      alerts.push(
        `uncleared setup row: notion_webhook_verification updated at ${inputs.setupUpdatedAt} (older than 24h)`,
      );
    }
  }

  return alerts;
}
