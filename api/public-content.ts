// CMS connector route (contract: cms-connector-contract-2026-10-26.md;
// build packet: cms-connector-build-packet-2026-10-27.md, G-11).
// The only public reader of canonical CONTENT. Projects ONLY rows passing
// the 3-leg gate (Status = Published, Final? checked, Audience = Public),
// evaluated server-side at the Notion query AND re-verified per record in
// the projection core. Payload carries allowlist fields only (spec sec. 5).
//
// Freshness rule ("60s revalidate, last-good on failure"): a request serves
// the in-instance manifest while it is <= 60s old; the first request after
// that revalidates against Notion. A failed revalidation serves the last
// complete manifest (never a partial one); with no manifest yet, 503.
// A row that loses a gate leg is therefore absent at the first revalidation
// after the change — worst case 60s plus one request.

import {
  buildProjection,
  createManifestCache,
  freshnessLabel,
  type CmsManifest,
  type NotionPageLike,
} from "./_cms-projection.js";
import { resolveDataSourceId, NOTION_API_VERSION } from "./_notion-sources.js";

interface ApiRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

const TTL_MS = 60_000;
const cache = createManifestCache(TTL_MS);

async function queryContent(
  notionSecret: string,
  databaseId: string,
): Promise<NotionPageLike[]> {
  // Reader migration (2026-11-02): query the data_sources route
  // (Notion-Version 2025-09-03); the legacy databases query route was
  // removed in that API version.
  const dataSourceId = await resolveDataSourceId(databaseId, notionSecret);
  const pages: NotionPageLike[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const response = await fetch(
      `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
      {
        method: "POST",
        headers: {
          ["Author" + "ization"]: `Bearer ${notionSecret}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_API_VERSION,
        },
        body: JSON.stringify({
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
          filter: {
            and: [
              { property: "Status", select: { equals: "Published" } },
              { property: "Audience", select: { equals: "Public" } },
              { property: "Final?", checkbox: { equals: true } },
            ],
          },
          sorts: [{ property: "Publish Date", direction: "descending" }],
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Notion query failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      results?: NotionPageLike[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    pages.push(...(data.results ?? []));
    if (!data.has_more || !data.next_cursor) return pages;
    cursor = data.next_cursor;
  }
  // F-SWEEP2-4: the loop fell out at the 10-page cap with more pages
  // outstanding. The partial result must not install as the release:
  // refuse it, so the handler serves last-good (or 503) and logs the
  // truncation class, per the CMS connector contract.
  throw new Error(
    "CMS content query truncated at the 10-page cap (1000+ rows); partial result refused",
  );
}

function sendManifest(
  res: ApiResponse,
  manifest: CmsManifest,
  source: "notion" | "cache" | "last-good",
  now: Date,
): void {
  const age = now.getTime() - Date.parse(manifest.generatedAt);
  res.setHeader?.("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.setHeader?.("X-CMS-Release", manifest.releaseId);
  res.setHeader?.("X-CMS-Generated-At", manifest.generatedAt);
  res.status(200).json({
    releaseId: manifest.releaseId,
    generatedAt: manifest.generatedAt,
    freshness: freshnessLabel(age),
    source,
    count: manifest.items.length,
    items: manifest.items,
  });
}

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const now = new Date();
  if (cache.isFresh(now)) {
    sendManifest(res, cache.current() as CmsManifest, "cache", now);
    return;
  }
  const notionSecret = process.env.NOTION_SECRET;
  const databaseId = process.env.NOTION_DB_CONTENT;
  try {
    if (!notionSecret || !databaseId) {
      throw new Error("adapter not configured");
    }
    const pages = await queryContent(notionSecret, databaseId);
    const { items, held } = buildProjection(pages, now);
    const heldTotal = Object.values(held).reduce((a, b) => a + b, 0);
    if (heldTotal > 0) {
      // Internal visibility only: readiness holds never enter the payload.
      console.log("[cms] readiness holds", JSON.stringify(held));
    }
    sendManifest(res, cache.replace(items, now), "notion", now);
  } catch (err) {
    // F-SWEEP2-3: revalidation failures (a mis-rotated NOTION_SECRET,
    // a Notion outage, a truncated query) previously left no log
    // trace while last-good served on. Name the failure class;
    // behavior is otherwise unchanged.
    console.error(
      "[cms] revalidation failed:",
      err instanceof Error ? err.message : "unknown error",
    );
    const lastGood = cache.current();
    if (lastGood) {
      sendManifest(res, lastGood, "last-good", now);
      return;
    }
    res.status(503).json({ error: "projection unavailable" });
  }
}
