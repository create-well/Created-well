/**
 * Guarded date labels (Track FE, FE-2 — the Invalid Date class closure).
 *
 * Every date a surface renders passes through here. Missing or
 * unparseable input degrades in words, never as the literal
 * "Invalid Date" (the class the 2026-10-25 canary named on the Next Up
 * card and the 2026-10-27 Track FE audit inventoried across eight-plus
 * surfaces). Wordings of record (design packet §4): event dates render
 * "Date not set yet."; undated tasks render "No date yet."
 */
export const DATE_NOT_SET = 'Date not set yet.';
export const NO_DATE_YET = 'No date yet.';

/**
 * Parse a source date value. Date-only strings (YYYY-MM-DD) parse as
 * local midnight, matching the surfaces' existing convention; anything
 * else goes through the Date parser. Returns null for missing, blank,
 * or unparseable input.
 */
export function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Format a source date value, or degrade to the fallback wording. */
export function dateLabel(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback: string = DATE_NOT_SET,
): string {
  const d = parseDateValue(value);
  return d ? d.toLocaleDateString('en-US', options) : fallback;
}

/** The common short form: "Oct 27". */
export function shortDateLabel(value: string | null | undefined, fallback: string = DATE_NOT_SET): string {
  return dateLabel(value, { month: 'short', day: 'numeric' }, fallback);
}

/** The common event form: "Mon, Oct 27". */
export function eventDateLabel(value: string | null | undefined, fallback: string = DATE_NOT_SET): string {
  return dateLabel(value, { weekday: 'short', month: 'short', day: 'numeric' }, fallback);
}

/**
 * Whole calendar days from `from` to `to`, computed from LOCAL
 * calendar components (via Date.UTC on the components) — immune
 * to DST. Dividing a millisecond span by 86_400_000 miscounts
 * across a transition: Oct 30 → Nov 2 spans 73 hours over the
 * fall-back, and ceil() reads it as 4 days instead of 3 (the
 * G-31 sweep's F1.1 class; the landed startingSoon fix is this
 * same precedent in homePanels).
 */
export function calendarDayDiff(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * 'YYYY-MM-DD' for the LOCAL calendar date. `toISOString()` is
 * UTC — from ~16:00–17:00 Pacific it is already tomorrow (the
 * G-31 sweep's F2.1 class).
 */
export function localDateString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
