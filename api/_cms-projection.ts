// CMS public projection core (contract: cms-connector-contract-2026-10-26.md;
// gate, allowlist, readiness holds, and manifest cache per its sections 2-4).
// Pure functions only: the gate, the allowlist projection, readiness holds,
// and the last-good manifest cache. The HTTP handler lives in public-content.ts.

export interface CmsItem {
  name: string;
  link: string;
  contentType: string | null;
  publishDate: string | null;
  where: string | null;
  tag: string | null;
}

export type HeldReason =
  | "missing_link"
  | "missing_publish_date"
  | "future_publish_date"
  | "missing_where";

export interface ProjectionResult {
  items: CmsItem[];
  held: Record<HeldReason, number>;
}

interface NotionProperty {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  date?: { start?: string } | null;
  checkbox?: boolean;
  url?: string | null;
}

export interface NotionPageLike {
  id: string;
  properties: Record<string, NotionProperty>;
}

function selectName(prop: NotionProperty | undefined): string | null {
  if (!prop) return null;
  return prop.select?.name ?? prop.status?.name ?? null;
}

function titleText(prop: NotionProperty | undefined): string {
  if (!prop?.title) return "";
  return prop.title.map((part) => part.plain_text ?? "").join("").trim();
}

// The 3-leg publication gate (spec section 4.1), evaluated per record.
// Gate fields are read here only; they never enter the projection.
export function passesGate(page: NotionPageLike): boolean {
  const status = selectName(page.properties["Status"]);
  const audience = selectName(page.properties["Audience"]);
  const finalChecked = page.properties["Final?"]?.checkbox === true;
  return status === "Published" && audience === "Public" && finalChecked;
}

// Allowlist projection (spec section 5): only PROJECT fields are read out.
// GATE fields, relations, formulas, rollups, and page bodies never appear.
export function projectRow(page: NotionPageLike): CmsItem {
  const props = page.properties;
  return {
    name: titleText(props["Name"]),
    link: props["Link"]?.url ?? "",
    contentType: selectName(props["Content Type"]),
    publishDate: props["Publish Date"]?.date?.start ?? null,
    where: selectName(props["Where"]),
    tag: selectName(props["Tag"]),
  };
}

// Readiness holds (spec section 4.2b): not gate legs. A gated row failing a
// readiness item is held out of the collection; the first failing item in
// this fixed order is the named reason.
// Publish dates are Pacific calendar dates (the CONTENT Publish Date is a
// date-only string in the team's timezone). Comparing them against the UTC
// date (now.toISOString()) releases a tomorrow-dated post up to ~7 hours
// early on a Pacific evening (finding F2.3). Derive the Pacific date from
// `now` with an explicit timezone instead; the server clock's own zone is
// never consulted.
export function pacificDateString(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function heldReason(item: CmsItem, now: Date): HeldReason | null {
  if (!item.link) return "missing_link";
  if (!item.publishDate) return "missing_publish_date";
  if (item.publishDate.slice(0, 10) > pacificDateString(now)) {
    return "future_publish_date";
  }
  if (!item.where) return "missing_where";
  return null;
}

export function buildProjection(
  pages: NotionPageLike[],
  now: Date,
): ProjectionResult {
  const held: Record<HeldReason, number> = {
    missing_link: 0,
    missing_publish_date: 0,
    future_publish_date: 0,
    missing_where: 0,
  };
  const items: CmsItem[] = [];
  for (const page of pages) {
    // The handler also filters at the Notion query; the gate is re-verified
    // here per record so a query change can never widen the projection.
    if (!passesGate(page)) continue;
    const item = projectRow(page);
    const reason = heldReason(item, now);
    if (reason) {
      held[reason] += 1;
      continue;
    }
    items.push(item);
  }
  items.sort((a, b) => {
    const byDate = (b.publishDate ?? "").localeCompare(a.publishDate ?? "");
    return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
  });
  return { items, held };
}

export interface CmsManifest {
  releaseId: string;
  generatedAt: string;
  items: CmsItem[];
}

export type Freshness = "Fresh" | "Aging" | "Stale";

// Freshness labels follow manifest age (spec 10.2 cache contract), never a
// bare "live" claim.
export function freshnessLabel(ageMs: number): Freshness {
  if (ageMs <= 120_000) return "Fresh";
  if (ageMs <= 900_000) return "Aging";
  return "Stale";
}

// Last-good manifest cache (spec 7.3 + 10.2): the public surface serves the
// last fully validated projection; a failed revalidation never replaces it.
// Phase 1 kept the manifest in the function instance. OPT-1 (2026-11-04)
// adds the durable tier the contract's section 7 names: an optional
// ManifestStore the cache hydrates from on cold start and the handler
// writes through after a successful revalidation, so a cold instance
// during a Notion outage serves the stored last-good instead of a 503.
// The in-memory manifest remains the serving source on every request;
// the store is read only while the cache is empty, never per request;
// a failed or timed-out store read is retried exactly once (register
// 1502), and a persistent failure degrades to exact Phase 1 behavior.
export interface ManifestStore {
  read: () => Promise<CmsManifest | null>;
  write: (manifest: CmsManifest) => Promise<void>;
}

const ITEM_KEYS = ["name", "link", "contentType", "publishDate", "where", "tag"];

// Shape check for a manifest coming back from durable storage (G-45 +
// F-SWEEP2-1 discipline): a stored value is served only if it is exactly
// manifest-shaped — string releaseId, a generatedAt Date.parse accepts,
// and items carrying precisely the six allowlist keys with string or
// null values. Anything else is not a manifest this surface may serve.
export function validateManifest(value: unknown): CmsManifest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.releaseId !== "string" || v.releaseId.length === 0) return null;
  if (typeof v.generatedAt !== "string" || !Number.isFinite(Date.parse(v.generatedAt))) {
    return null;
  }
  if (!Array.isArray(v.items)) return null;
  for (const item of v.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const keys = Object.keys(item as Record<string, unknown>);
    if (keys.length !== ITEM_KEYS.length) return null;
    for (const key of ITEM_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) return null;
      const field = (item as Record<string, unknown>)[key];
      if (key === "name" || key === "link") {
        if (typeof field !== "string") return null;
      } else if (field !== null && typeof field !== "string") {
        return null;
      }
    }
  }
  return value as CmsManifest;
}

export interface ManifestCache {
  current: () => CmsManifest | null;
  ageMs: (now: Date) => number | null;
  isFresh: (now: Date) => boolean;
  replace: (items: CmsItem[], now: Date) => CmsManifest;
  hydrate: () => Promise<boolean>;
  persist: () => Promise<void>;
}

export function createManifestCache(
  ttlMs: number,
  store?: ManifestStore,
  hydrateTimeoutMs = 1_500,
): ManifestCache {
  let manifest: CmsManifest | null = null;
  let counter = 0;
  let hydrating: Promise<boolean> | null = null;
  return {
    current: () => manifest,
    ageMs: (now) =>
      manifest ? now.getTime() - Date.parse(manifest.generatedAt) : null,
    isFresh: (now) => {
      if (!manifest) return false;
      return now.getTime() - Date.parse(manifest.generatedAt) <= ttlMs;
    },
    replace: (items, now) => {
      counter += 1;
      manifest = {
        releaseId: `${now.getTime()}-${counter}`,
        generatedAt: now.toISOString(),
        items,
      };
      return manifest;
    },
    hydrate: () => {
      // Single-flight: concurrent cold requests share one store read.
      // Only an empty cache hydrates; once anything is installed
      // (stored or revalidated), hydration never runs again.
      if (manifest || !store) return Promise.resolve(false);
      if (!hydrating) {
        hydrating = (async () => {
          // One store-read attempt with a discriminated outcome: a hit,
          // a definitive empty (null), a thrown failure, or a timeout.
          // The timeout resolves to a symbol so a slow read is never
          // mistaken for an empty store.
          const TIMED_OUT = Symbol("hydrate-timeout");
          const attempt = async (): Promise<
            | { kind: "hit"; stored: CmsManifest }
            | { kind: "empty" }
            | { kind: "error"; message: string }
            | { kind: "timeout" }
          > => {
            try {
              const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
                const t = setTimeout(() => resolve(TIMED_OUT), hydrateTimeoutMs);
                (t as { unref?: () => void }).unref?.();
              });
              const result = await Promise.race([store.read(), timeout]);
              if (result === TIMED_OUT) return { kind: "timeout" };
              return result ? { kind: "hit", stored: result } : { kind: "empty" };
            } catch (err) {
              return {
                kind: "error",
                message: err instanceof Error ? err.message : "unknown error",
              };
            }
          };
          try {
            // Retry-once (register 1502): a FAILED or TIMED-OUT store
            // read is retried exactly once inside the same hydration,
            // and the retry is logged with its leg so a degraded frame
            // names which leg failed. An EMPTY store is a definitive
            // answer and is never retried; a failed revalidation is the
            // handler's leg, not this one. Worst case added latency is
            // one extra read plus one extra hydrate timeout.
            let outcome = await attempt();
            if (outcome.kind === "error" || outcome.kind === "timeout") {
              console.error(
                outcome.kind === "error"
                  ? `[cms] manifest store read failed: ${outcome.message}; retrying once`
                  : "[cms] manifest store read timed out; retrying once",
              );
              outcome = await attempt();
              if (outcome.kind === "error") {
                console.error(`[cms] manifest store read failed: ${outcome.message}`);
              } else if (outcome.kind === "timeout") {
                console.error("[cms] manifest store read timed out");
              }
            }
            if (outcome.kind === "hit" && !manifest) {
              manifest = outcome.stored;
              return true;
            }
            return false;
          } finally {
            hydrating = null;
          }
        })();
      }
      return hydrating;
    },
    persist: async () => {
      if (!store || !manifest) return;
      try {
        await store.write(manifest);
      } catch (err) {
        // Failure-isolated by design: the in-memory manifest is already
        // this instance's truth; a store write error only logs its class.
        console.error(
          "[cms] manifest store write failed:",
          err instanceof Error ? err.message : "unknown error",
        );
      }
    },
  };
}
