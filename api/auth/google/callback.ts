import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_GOOGLE_REDIRECT_URI = 'https://dash.cr8w.com/api/auth/google/callback';

type GoogleOAuthState = {
  nonce?: string;
  returnUrl?: string;
  user?: string;
};

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function decodeState(rawState: string | undefined): GoogleOAuthState | null {
  if (!rawState) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(rawState));
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function isAllowedReturnUrl(rawUrl: string | undefined): rawUrl is string {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;
    if ((host === 'localhost' || host === '127.0.0.1') && url.protocol === 'http:') return true;
    if (url.protocol !== 'https:') return false;
    return (
      host === 'dash.cr8w.com' ||
      host === 'www.cr8w.com' ||
      host === 'cr8w.com' ||
      host === 'createwell.monnyfest.co' ||
      host.endsWith('.cr8w.com') ||
      host.endsWith('.monnyfest.co') ||
      host.endsWith('.vercel.app')
    );
  } catch {
    return false;
  }
}

function redirectWithHash(res: VercelResponse, returnUrl: string, params: Record<string, string | undefined>): void {
  const url = new URL(returnUrl);
  url.hash = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
  ).toString();
  res.status(302).setHeader('Location', url.toString()).end();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const state = decodeState(typeof req.query.state === 'string' ? req.query.state : undefined);
  if (!state || !isAllowedReturnUrl(state.returnUrl) || !state.nonce) {
    res.status(400).json({ error: 'Invalid Google OAuth state' });
    return;
  }

  const googleError = typeof req.query.error === 'string' ? req.query.error : undefined;
  if (googleError) {
    redirectWithHash(res, state.returnUrl, {
      gcal_error: googleError,
      gcal_nonce: state.nonce,
      gcal_user: state.user,
    });
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  if (!code) {
    redirectWithHash(res, state.returnUrl, {
      gcal_error: 'Missing Google authorization code',
      gcal_nonce: state.nonce,
      gcal_user: state.user,
    });
    return;
  }

  const clientId = process.env.GCAL_CLIENT_ID ?? process.env.VITE_GCAL_CLIENT_ID ?? '411548888468-3volgsnl2spba4gcfgik620o0al7pq1v.apps.googleusercontent.com';
  const clientSecret = process.env.GCAL_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? process.env.VITE_GOOGLE_REDIRECT_URI ?? DEFAULT_GOOGLE_REDIRECT_URI;

  if (!clientSecret) {
    redirectWithHash(res, state.returnUrl, {
      gcal_error: 'GCAL_CLIENT_SECRET not configured',
      gcal_nonce: state.nonce,
      gcal_user: state.user,
    });
    return;
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
    console.error('[GCal OAuth] Token exchange error:', tokenData.error, tokenData.error_description);
    redirectWithHash(res, state.returnUrl, {
      gcal_error: tokenData.error_description || tokenData.error || 'Google token exchange failed',
      gcal_nonce: state.nonce,
      gcal_user: state.user,
    });
    return;
  }

  redirectWithHash(res, state.returnUrl, {
    gcal_access_token: tokenData.access_token,
    gcal_refresh_token: tokenData.refresh_token,
    gcal_nonce: state.nonce,
    gcal_user: state.user,
  });
}
