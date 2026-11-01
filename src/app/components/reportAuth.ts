export interface StorageReader {
  getItem(key: string): string | null;
}

const AUTH_STORAGE_KEY = 'cr8w_supabase_auth';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAccessToken(storage: StorageReader | null | undefined): string | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const session: unknown = JSON.parse(raw);
    if (!isRecord(session)) return null;

    const legacySession = isRecord(session.currentSession) ? session.currentSession : null;
    const token = [session.access_token, legacySession?.access_token]
      .find((candidate) => typeof candidate === 'string' && candidate.trim());
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

export function headersForApiRequest(
  path: string,
  baseHeaders: Record<string, string>,
  storage: StorageReader | null | undefined,
): Record<string, string> {
  const requestPath = path.split('?', 1)[0];
  if (!requestPath.startsWith('/reports/')) return { ...baseHeaders };

  const headers = { ...baseHeaders };
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'authorization') delete headers[name];
  }

  const accessToken = readAccessToken(storage);
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}
