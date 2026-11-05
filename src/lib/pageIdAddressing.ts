// RR-004 (shape A): dual-write resources (tasks, stations, forum,
// coflow-dates) present Notion-sourced records under a numeric
// stableId hash, but the server's KV shadow list is keyed by
// create-time ids — a PUT addressed by the hash misses and 404s.
// The payload record carries its Notion page id (notionPageId, from
// the normalizers), and the server accepts a PUT addressed by that
// page id, writing through to Notion. So a write to a Notion-sourced
// record addresses by page id; a KV-born record (no page id) keeps
// its numeric id.

export function writeAddress(
  record: { id: number; notionPageId?: string } | undefined,
  fallbackId: number,
): number | string {
  return record?.notionPageId ?? fallbackId;
}
