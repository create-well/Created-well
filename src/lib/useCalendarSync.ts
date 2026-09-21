import { useState, useEffect, useCallback } from 'react';
import { GCAL_CLIENT_ID, GCAL_REDIRECT_URI } from '../app/components/data';

// localStorage keys — all prefixed gcal_ per existing App.tsx convention
const LS_FRESH = 'gcal_token_fresh';
const LS_ERROR = 'gcal_token_error';
const LS_TOKEN = 'gcal_access_token';
const LS_USER = 'gcal_oauth_user';
const LS_LAST_SYNCED = 'gcal_last_synced';

export type CalendarStatus = 'idle' | 'connecting' | 'syncing' | 'connected' | 'error';

export interface CalendarSyncState {
  status: CalendarStatus;
  connectedUser: string | null;
  lastSynced: Date | null;
  errorMsg: string | null;
  connect: (profileKey: string) => Promise<void>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
}

// Generates a random PKCE code_verifier (base64url, 43 chars)
function base64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr);
}

async function deriveChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(digest);
}

function humanizeError(raw: string | null): string {
  if (!raw) return 'Something went wrong connecting your calendar. Try again.';
  if (raw.includes('invalid_grant') || raw.includes('expired')) {
    return 'Your authorization expired before completing. Try connecting again.';
  }
  if (raw.includes('access_denied')) {
    return 'Access was declined. You can try again whenever you\'re ready.';
  }
  if (raw.includes('redirect_uri_mismatch')) {
    return 'There was a configuration mismatch. Contact the team to sort it out.';
  }
  return 'Connection to Google Calendar failed. Try again — it\'s probably temporary.';
}

function resolveApiBase(): string {
  if (typeof import.meta !== 'undefined' && (import.meta.env as any).VITE_API_BASE) {
    return (import.meta.env as any).VITE_API_BASE as string;
  }
  if (typeof window === 'undefined') return '/api/server';
  const host = window.location.hostname;
  const isFirstParty =
    host.endsWith('.vercel.app') ||
    host === 'cr8w.com' ||
    host.endsWith('.cr8w.com') ||
    host === 'createwell.monnyfest.co' ||
    host.endsWith('.monnyfest.co') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  return isFirstParty ? '/api/server' : '/api/server';
}

const GCAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'openid',
  'email',
].join(' ');

export function useCalendarSync(): CalendarSyncState {
  const [status, setStatus] = useState<CalendarStatus>(() => {
    const fresh = localStorage.getItem(LS_FRESH);
    const token = localStorage.getItem(LS_TOKEN);
    if (fresh === 'ready' || (token && fresh !== 'error' && fresh !== 'pending')) return 'connected';
    if (fresh === 'error') return 'error';
    if (fresh === 'pending') return 'connecting';
    return 'idle';
  });

  const [connectedUser, setConnectedUser] = useState<string | null>(
    () => localStorage.getItem(LS_USER)
  );

  const [lastSynced, setLastSynced] = useState<Date | null>(() => {
    const ts = localStorage.getItem(LS_LAST_SYNCED);
    return ts ? new Date(ts) : null;
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(
    () => status === 'error' ? humanizeError(localStorage.getItem(LS_ERROR)) : null
  );

  // Poll localStorage while connecting — fires after App.tsx module-level exchange resolves
  useEffect(() => {
    if (status !== 'connecting') return;
    const id = setInterval(() => {
      const fresh = localStorage.getItem(LS_FRESH);
      if (fresh === 'ready') {
        setStatus('connected');
        setConnectedUser(localStorage.getItem(LS_USER));
        setErrorMsg(null);
      } else if (fresh === 'error') {
        setStatus('error');
        setErrorMsg(humanizeError(localStorage.getItem(LS_ERROR)));
      }
    }, 400);
    // Give up after 90 seconds if neither state arrives (network hung)
    const bail = setTimeout(() => {
      setStatus('error');
      setErrorMsg('Connection timed out. Try again.');
    }, 90_000);
    return () => { clearInterval(id); clearTimeout(bail); };
  }, [status]);

  // Also listen for StorageEvent from a second tab (window.open OAuth flow)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== LS_FRESH) return;
      if (e.newValue === 'ready') {
        setStatus('connected');
        setConnectedUser(localStorage.getItem(LS_USER));
        setErrorMsg(null);
      } else if (e.newValue === 'error') {
        setStatus('error');
        setErrorMsg(humanizeError(localStorage.getItem(LS_ERROR)));
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const connect = useCallback(async (profileKey: string) => {
    setStatus('connecting');
    const verifier = generateVerifier();
    const challenge = await deriveChallenge(verifier);
    localStorage.setItem('gcal_pkce_verifier', verifier);
    localStorage.setItem(LS_USER, profileKey);
    localStorage.setItem(LS_FRESH, 'pending');

    const params = new URLSearchParams({
      client_id: GCAL_CLIENT_ID,
      redirect_uri: GCAL_REDIRECT_URI,
      response_type: 'code',
      scope: GCAL_SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });
    // Same-tab redirect — App.tsx captures the ?code= on return
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(LS_FRESH);
    localStorage.removeItem(LS_ERROR);
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_LAST_SYNCED);
    localStorage.removeItem('gcal_pkce_verifier');
    setStatus('idle');
    setConnectedUser(null);
    setLastSynced(null);
    setErrorMsg(null);
  }, []);

  const syncNow = useCallback(async () => {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;
    setStatus('syncing');
    const BASE = resolveApiBase();
    try {
      const res = await fetch(`${BASE}/calendar-ical-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const now = new Date();
      localStorage.setItem(LS_LAST_SYNCED, now.toISOString());
      setLastSynced(now);
      setStatus('connected');
    } catch {
      // Don't flip to error on sync failure — keep connected, just no update
      setStatus('connected');
    }
  }, []);

  return { status, connectedUser, lastSynced, errorMsg, connect, disconnect, syncNow };
}
