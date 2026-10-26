/**
 * Short date label for a YYYY-MM-DD date string, or null when the value
 * is missing or unparseable. Cards degrade to the title alone instead of
 * rendering the literal "Invalid Date" (canary finding, 2026-10-25).
 */
export function formatShortDateLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Title · Oct 26" when the date parses; the title alone when it does not. */
export function milestoneLabel(title: string, dateStr: string | null | undefined): string {
  const cleanTitle = title.replace(/\s*🚀/, '');
  const dateLabel = formatShortDateLabel(dateStr);
  return dateLabel ? `${cleanTitle} · ${dateLabel}` : cleanTitle;
}
