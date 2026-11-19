// Packet CC honesty leg — a failed KV read degrades its slice to
// empty server-side (api/dashboard.ts settleNamed) and names the
// failure in the payload's sourceErrors under the slice's kv: key.
// A degraded slice is never a successfully empty slice: a surface
// that would render a calm empty for it names the failure instead.
export function kvSliceError(
  sourceErrors: Record<string, string> | undefined,
  key: string,
): string | null {
  const error = sourceErrors?.[key];
  return typeof error === 'string' && error !== '' ? error : null;
}
