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
// Phase 1 keeps the manifest in the function instance; the durable store is
// the named Phase 2 step (cms design note, 2026-10-26).
export interface ManifestCache {
  current: () => CmsManifest | null;
  ageMs: (now: Date) => number | null;
  isFresh: (now: Date) => boolean;
  replace: (items: CmsItem[], now: Date) => CmsManifest;
}

export function createManifestCache(ttlMs: number): ManifestCache {
  let manifest: CmsManifest | null = null;
  let counter = 0;
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
  };
}
