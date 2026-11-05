// Canonical-slice load rule (paired with the legacy /sync retirement):
// the four Notion-canonical slices (tasks, stations, coflowDates, money)
// are ABSENT from the fallback response — the server names them in
// canonicalSlicesUnavailable rather than serving a stale KV mirror.
// On a fallback load the client therefore holds its last-good in-memory
// values instead of blanking them; on a primary load the incoming slice
// governs, with an absent field reading as an honest empty.

export function canonicalOnLoad<T>(usedFallback: boolean, incoming: T[] | undefined, lastGood: T[]): T[] {
  if (usedFallback) return lastGood;
  return incoming || [];
}
