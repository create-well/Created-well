import React, { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { DashboardProvider } from '../contexts/DashboardContext';
import { AuthGate, isAuthenticated, getStoredProfile } from './components/AuthGate';
import { useThemeInit } from './components/ThemeProvider';
import { GCAL_CLIENT_ID } from './components/data';

// ── Google Calendar OAuth: capture auth code at module-eval time ──────────────
(function captureOAuthCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    const codeVerifier = localStorage.getItem('gcal_pkce_verifier');
    if (!codeVerifier) {
      console.error('[GCal OAuth] No PKCE code_verifier in localStorage — ignoring ?code param');
      return;
    }

    window.history.replaceState(null, '', window.location.pathname);
    console.log('[GCal OAuth] Auth code captured, exchanging for token via server...');
    localStorage.setItem('gcal_token_fresh', 'pending');

    import('/utils/supabase/info').then(({ projectId, publicAnonKey }) => {
      const host = window.location.hostname;
      const onVercelOrDomain = host.endsWith('.vercel.app') || host === 'createwell.monnyfest.co' || host === 'localhost' || host === '127.0.0.1';
      const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)
        ?? (onVercelOrDomain ? '/api/server' : 'https://cr8w-home-v2.vercel.app/api/server');
      const serverUrl = `${apiBase}/gcal-token-exchange`;

      fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          code, code_verifier: codeVerifier,
          redirect_uri: window.location.origin,
          client_id: GCAL_CLIENT_ID,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            console.error('[GCal OAuth] Token exchange error:', data.error, data.error_description);
            localStorage.setItem('gcal_token_fresh', 'error');
            localStorage.setItem('gcal_token_error', data.error_description || data.error);
            return;
          }
          if (data.access_token) {
            localStorage.setItem('gcal_access_token', data.access_token);
            const oauthUser = localStorage.getItem('gcal_oauth_user');
            if (oauthUser) localStorage.setItem(`gcal_token_${oauthUser.toUpperCase()}`, data.access_token);
            localStorage.setItem('gcal_token_fresh', 'ready');
            console.log('[GCal OAuth] Token exchange successful' + (oauthUser ? ` for ${oauthUser}` : ''));
          }
          localStorage.removeItem('gcal_pkce_verifier');
        })
        .catch(err => {
          console.error('[GCal OAuth] Token exchange fetch error:', err);
          localStorage.setItem('gcal_token_fresh', 'error');
          localStorage.setItem('gcal_token_error', String(err));
        });
    });
  } catch (e) {
    console.error('[GCal OAuth] Code capture error:', e);
  }
})();

// ── PWA meta tags + service worker registration ───────────────────────────────
function usePWA() {
  useEffect(() => {
    const metaTags: { name: string; content: string }[] = [
      { name: 'theme-color', content: '#C25B38' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Create Well' },
    ];
    const injected: HTMLElement[] = [];
    for (const tag of metaTags) {
      if (document.head.querySelector(`meta[name="${tag.name}"]`)) continue;
      const el = document.createElement('meta');
      el.setAttribute('name', tag.name);
      el.setAttribute('content', tag.content);
      document.head.appendChild(el);
      injected.push(el);
    }
    if (!document.head.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.json';
      document.head.appendChild(manifest);
      injected.push(manifest);
    }
    if (!document.head.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/assets/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png';
      document.head.appendChild(icon);
      injected.push(icon);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[PWA] Service worker registered:', reg.scope))
        .catch(err => console.log('[PWA] Service worker registration failed:', err));
    }
    return () => { injected.forEach(el => el.remove()); };
  }, []);
}

export default function App() {
  useThemeInit();
  usePWA();

  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [chatActiveUser, setChatActiveUser] = useState(
    () => { const p = getStoredProfile(); return (p && p !== 'event-support') ? p : 'monny'; }
  );

  function handleAuthenticated(profileKey: string) {
    setAuthed(true);
    setChatActiveUser(profileKey === 'event-support' ? 'monny' : profileKey);
  }

  async function handleSignOut() {
    const { signOut } = await import('./components/AuthGate');
    await signOut();
    setAuthed(false);
    window.location.reload();
  }

  if (!authed) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <DashboardProvider onSignOut={handleSignOut}>
      <RouterProvider router={router} />
    </DashboardProvider>
  );
}
