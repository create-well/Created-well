/**
 * Shared server-side auth + CORS for the createdwell API routes.
 *
 * Design (CW-INTERNAL-DASHBOARD-01, Phase 1 security candidate, rev7):
 *   • A user session token (Supabase Auth, sent by the client helper as
 *     Authorization: Bearer <access_token>) is validated server-side with
 *     auth.getUser. Tokens whose JWT role claim is "anon" or "service_role"
 *     are rejected outright: the publishable/anon key and the service-role
 *     key are not user sessions and must never unlock these routes.
 *   • Fails closed: no token or an invalid token is a 401; missing auth
 *     configuration (SUPABASE_URL / anon key env) is a visible 503, never
 *     a silent pass.
 *   • CORS is an allowlist of the app's own origins, reflected only when
 *     the request Origin matches. www.cr8w.com is deliberately NOT on the
 *     list: it now serves the external build (identity assertion,
 *     createdwell-rebind-packet.md Step 0).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

export const ALLOWED_ORIGINS = [
  'https://createdwell.vercel.app',
  'https://createdwell-monnylog.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;

export function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS as readonly string[]).includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    // Non-browser callers and non-allowlisted origins get the canonical
    // origin only, which a browser will not accept for cross-origin reads
    // from any other site.
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header)) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** Decode a JWT payload without trusting it (claim pre-filter only). */
function jwtRoleClaim(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export type SessionCheck =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 503 };

export async function checkSession(req: VercelRequest): Promise<SessionCheck> {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401 };

  // The anon/publishable key and the service-role key are not sessions.
  const role = jwtRoleClaim(token);
  if (role === 'anon' || role === 'service_role') return { ok: false, status: 401 };

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return { ok: false, status: 503 };

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return { ok: false, status: 401 };
    if (data.user.role && data.user.role !== 'authenticated') return { ok: false, status: 401 };
    return { ok: true, userId: data.user.id };
  } catch {
    return { ok: false, status: 401 };
  }
}

/** Gate a route on a valid user session. Writes the failure response. */
export async function requireSession(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const check = await checkSession(req);
  if (check.ok) return true;
  if (check.status === 503) {
    res.status(503).json({ error: 'Auth not configured' });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
  return false;
}

export function isCronAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const token = bearerToken(req);
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Gate a route on a user session OR the cron secret (scheduled callers). */
export async function requireSessionOrCron(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (isCronAuthorized(req)) return true;
  return requireSession(req, res);
}
