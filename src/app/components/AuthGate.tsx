/**
 * CR8W Create Well — Auth Gate (real Supabase Auth)
 *
 * Flow
 *   Sign In        → email + password → supabase.auth.signInWithPassword
 *   Register       → email + password + display name + profile → signUp
 *   Forgot pw      → email → resetPasswordForEmail → user clicks email link
 *   PASSWORD_RECOVERY (from email link) → set-new-password form → updateUser
 *
 * The chosen profile key is mirrored to localStorage.cr8w_user_profile
 * so the rest of the app (chat identity, dashboards) keeps working.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { lookupUsername, registerUsername } from './api';
import cwLogoImg from 'figma:asset/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png';

// ── Supabase browser client ───────────────────────────────────────────────────
// SUPABASE_ANON_JWT: JWT anon key required by Supabase Auth (signIn, signUp, etc.)
// publicAnonKey from info.tsx is the sb_publishable key used for Edge Function calls.
const SUPABASE_URL = `https://${projectId}.supabase.co`;
const SUPABASE_ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydHFjeWdyaWVkdmRpanBwbnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNjMwOTEsImV4cCI6MjEwNDczOTA5MX0.tmItTHhTcsV7yLNUv7XiECJ4wY6_sA87PUIcD4hYU5Y";
const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-dabe1c74`;

// Persist on window so HMR module re-evaluations reuse the same GoTrueClient
// and avoid the "Multiple GoTrueClient instances" warning.
declare global { interface Window { __cr8w_supabase__?: SupabaseClient } }

function client(): SupabaseClient {
  if (!window.__cr8w_supabase__) {
    window.__cr8w_supabase__ = createClient(SUPABASE_URL, SUPABASE_ANON_JWT, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cr8w_supabase_auth' },
    });
  }
  return window.__cr8w_supabase__;
}

// ── Profiles & Access Control (canonical source: src/config/profiles.ts) ──────
import { PROFILES_LIST, ADMIN_EMAILS, isAdmin } from '../../config/profiles';
export const PROFILES = PROFILES_LIST;
export { ADMIN_EMAILS, isAdmin };

export function getStoredAdmin(): boolean {
  try { return localStorage.getItem('cr8w_is_admin') === 'true'; } catch { return false; }
}

export function getStoredEmail(): string | null {
  try { return localStorage.getItem('cr8w_user_email'); } catch { return null; }
}

// ── Sync helpers used by App.tsx ──────────────────────────────────────────────
export function isAuthenticated(): boolean {
  try {
    const raw = localStorage.getItem('cr8w_supabase_auth');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const expiresAt = parsed?.expires_at ?? parsed?.currentSession?.expires_at ?? 0;
    return expiresAt * 1000 > Date.now();
  } catch { return false; }
}

export function getStoredProfile(): string | null {
  try { return localStorage.getItem('cr8w_user_profile'); } catch { return null; }
}

export async function signOut(): Promise<void> {
  try { await client().auth.signOut(); } catch {}
  try { localStorage.removeItem('cr8w_user_profile'); } catch {}
}

// ── Friendly error messages for common Supabase Auth codes ────────────────────
function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials'))  return 'Wrong email or password. Try again.';
  if (m.includes('email not confirmed'))         return 'Check your email and click the confirmation link first, then sign in.';
  if (m.includes('user already registered'))     return 'An account with that email already exists. Sign in instead.';
  if (m.includes('for security purposes'))       return 'Too many attempts — wait a minute and try again.';
  if (m.includes('rate limit'))                  return 'Too many attempts — wait a minute and try again.';
  if (m.includes('signup disabled'))             return 'New registrations are currently closed.';
  if (m.includes('user not found'))              return 'No account found with that email. Create one first.';
  if (m.includes('password should be'))          return 'Password must be at least 6 characters.';
  return msg;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { onAuthenticated: (profileKey: string) => void; }
type Mode = 'signin' | 'register' | 'reset' | 'newpassword';

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#FAF6F2 0%,#F4EDE6 40%,#EDE4DA 100%)', padding: '24px 16px', fontFamily: 'var(--font-body,"Montserrat",sans-serif)' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(194,91,56,0.12) 0%,transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(123,168,157,0.14) 0%,transparent 70%)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
  border: '1.5px solid rgba(212,167,113,0.4)', background: 'rgba(255,255,255,0.92)',
  fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.95rem', color: '#2D2438', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.72rem',
  fontWeight: 700, color: '#A07060', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7,
};

export function AuthGate({ onAuthenticated }: Props) {
  const [mode, setMode]               = useState<Mode>('signin');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [newPw, setNewPw]             = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [showNewPw, setShowNewPw]     = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername]       = useState('');
  const [profile, setProfile]         = useState('monny');
  const [error, setError]             = useState('');
  const [notice, setNotice]           = useState('');
  const [busy, setBusy]               = useState(false);
  const [shake, setShake]             = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const triggerShake = useCallback(() => {
    setShake(true); setTimeout(() => setShake(false), 550);
  }, []);

  useEffect(() => {
    let active = true;

    // Listen for PASSWORD_RECOVERY: fires when user arrives via a reset-password email link.
    // Without this, the recovery token is silently dropped and the user can never set a new pw.
    const { data: { subscription } } = client().auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setCheckingSession(false);
        setMode('newpassword');
      }
    });

    // Check for an existing live session on mount.
    client().auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      if (session) {
        const key = session.user?.user_metadata?.cr8w_profile ?? getStoredProfile() ?? 'monny';
        const userEmail = session.user?.email ?? '';
        localStorage.setItem('cr8w_user_profile', key);
        localStorage.setItem('cr8w_user_email', userEmail);
        if (isAdmin(userEmail)) localStorage.setItem('cr8w_is_admin', 'true');
        else localStorage.removeItem('cr8w_is_admin');
        onAuthenticated(key);
      } else {
        setCheckingSession(false);
      }
    }).catch(() => { if (active) setCheckingSession(false); });

    return () => { active = false; subscription.unsubscribe(); };
  }, [onAuthenticated]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true); setError(''); setNotice('');

    // Resolve username → email via Edge Function before Supabase auth
    let resolvedEmail = email.trim().toLowerCase();
    if (!resolvedEmail.includes('@')) {
      const res = await fetch(`${BASE}/resolve-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ username: resolvedEmail }),
      });
      if (!res.ok) { setError('Sign in failed'); triggerShake(); setBusy(false); return; }
      resolvedEmail = (await res.json()).email;
    }

    const { data, error: err } = await client().auth.signInWithPassword({
      email: resolvedEmail, password,
    });
    setBusy(false);
    if (err || !data.session) {
      setError(friendlyError(err?.message ?? 'Sign in failed — check your credentials.'));
      triggerShake();
      return;
    }
    const key = data.user?.user_metadata?.cr8w_profile ?? 'monny';
    const userEmail = data.user?.email ?? '';
    localStorage.setItem('cr8w_user_profile', key);
    localStorage.setItem('cr8w_user_email', userEmail);
    if (isAdmin(userEmail)) localStorage.setItem('cr8w_is_admin', 'true');
    else localStorage.removeItem('cr8w_is_admin');
    onAuthenticated(key);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || !displayName.trim()) return;
    if (password.length < 6) { setError('Password must be at least 6 characters.'); triggerShake(); return; }
    const uname = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (username.trim() && uname.length < 2) {
      setError('Username must be at least 2 characters (letters, numbers, _ or -).');
      triggerShake(); return;
    }
    setBusy(true); setError(''); setNotice('');
    const { data, error: err } = await client().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { cr8w_profile: profile, display_name: displayName.trim(), cr8w_username: uname || undefined } },
    });
    setBusy(false);
    if (err) { setError(friendlyError(err.message)); triggerShake(); return; }
    // Register username → email mapping server-side so sign-in by username works
    if (uname && data.user?.email) {
      registerUsername(uname, data.user.email).catch(() => {}); // non-blocking
    }
    localStorage.setItem('cr8w_user_profile', profile);
    if (data.session) {
      // Email confirmation is OFF — session returned immediately.
      onAuthenticated(profile);
    } else {
      // Email confirmation is ON — user must confirm before signing in.
      setNotice('Account created! Check your email to confirm, then sign in here.');
      setMode('signin');
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError(''); setNotice('');
    const { error: err } = await client().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (err) { setError(friendlyError(err.message)); triggerShake(); return; }
    setNotice('Reset link sent — check your inbox. Click the link, then set your new password here.');
    setMode('signin');
  }

  // Called after user clicks the email reset link and arrives at this screen.
  // Supabase has already set a recovery session; updateUser persists the new password.
  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 6) { setError('Password must be at least 6 characters.'); triggerShake(); return; }
    if (newPw !== newPwConfirm) { setError('Passwords do not match.'); triggerShake(); return; }
    setBusy(true); setError(''); setNotice('');
    const { data, error: err } = await client().auth.updateUser({ password: newPw });
    setBusy(false);
    if (err) { setError(friendlyError(err.message)); triggerShake(); return; }
    const key = data.user?.user_metadata?.cr8w_profile ?? getStoredProfile() ?? 'monny';
    const userEmail = data.user?.email ?? '';
    localStorage.setItem('cr8w_user_profile', key);
    localStorage.setItem('cr8w_user_email', userEmail);
    if (isAdmin(userEmail)) localStorage.setItem('cr8w_is_admin', 'true');
    else localStorage.removeItem('cr8w_is_admin');
    onAuthenticated(key);
  }

  const isSubMode = mode === 'reset' || mode === 'newpassword';

  if (checkingSession) {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: '#A07060', fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.85rem' }}>
          <img src={cwLogoImg} alt="Create Well" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 14, opacity: 0.85 }} />
          <div>loading…</div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(14px)', borderRadius: 24, boxShadow: '0 8px 40px rgba(194,91,56,0.12),0 2px 8px rgba(0,0,0,0.06)', padding: '36px 32px 30px', border: '1px solid rgba(212,167,113,0.25)', animation: shake ? 'cr8w-shake 0.5s ease' : 'none' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={cwLogoImg} alt="Create Well" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', marginBottom: 10, boxShadow: '0 4px 16px rgba(194,91,56,0.2)' }} />
          <div style={{ fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1.8rem', fontWeight: 700, color: '#C25B38', lineHeight: 1 }}>Create Well</div>
          <div style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.7rem', color: '#A07060', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>CR8W Dashboard</div>
        </div>

        {/* Mode toggle — hidden for sub-flows */}
        {!isSubMode && (
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(194,91,56,0.06)', borderRadius: 12, marginBottom: 22 }}>
            {(['signin', 'register'] as Mode[]).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(''); setNotice(''); }}
                style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.03em', background: mode === m ? '#C25B38' : 'transparent', color: mode === m ? '#fff' : '#A07060', transition: 'all 0.15s' }}>
                {m === 'signin' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
        )}

        {/* Sub-flow headers */}
        {mode === 'reset' && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.78rem', fontWeight: 700, color: '#C25B38', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Reset Password</div>
            <div style={{ fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.73rem', color: '#A07060', marginTop: 4 }}>We&apos;ll email you a reset link.</div>
          </div>
        )}
        {mode === 'newpassword' && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.78rem', fontWeight: 700, color: '#C25B38', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Set New Password</div>
            <div style={{ fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.73rem', color: '#A07060', marginTop: 4 }}>Choose a password for your account.</div>
          </div>
        )}

        {notice && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(123,168,157,0.1)', border: '1px solid rgba(123,168,157,0.3)', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.76rem', color: '#3A7A3A', lineHeight: 1.5 }}>
            ✓ {notice}
          </div>
        )}

        {/* ── Set-new-password form (recovery flow) ── */}
        {mode === 'newpassword' && (
          <form onSubmit={handleSetNewPassword} noValidate>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={e => { setNewPw(e.target.value); setError(''); }}
                  placeholder="at least 6 characters" autoComplete="new-password" autoFocus
                  style={{ ...inputStyle, paddingRight: 44, border: `1.5px solid ${error ? '#E05040' : 'rgba(212,167,113,0.4)'}` }}
                  onFocus={e => e.currentTarget.style.borderColor = '#C25B38'} onBlur={e => e.currentTarget.style.borderColor = error ? '#E05040' : 'rgba(212,167,113,0.4)'} />
                <button type="button" onClick={() => setShowNewPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#A07060', padding: 4 }}>
                  {showNewPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input type={showNewPw ? 'text' : 'password'} value={newPwConfirm} onChange={e => { setNewPwConfirm(e.target.value); setError(''); }}
                placeholder="same password again" autoComplete="new-password"
                style={{ ...inputStyle, border: `1.5px solid ${error ? '#E05040' : 'rgba(212,167,113,0.4)'}` }}
                onFocus={e => e.currentTarget.style.borderColor = '#C25B38'} onBlur={e => e.currentTarget.style.borderColor = error ? '#E05040' : 'rgba(212,167,113,0.4)'} />
            </div>
            {error && <div style={{ marginBottom: 16, fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.76rem', color: '#C03020', lineHeight: 1.4 }}>{error}</div>}
            <button type="submit" disabled={busy} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: busy ? 'rgba(194,91,56,0.4)' : '#C25B38', color: '#fff', fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', boxShadow: busy ? 'none' : '0 4px 16px rgba(194,91,56,0.3)', transition: 'background 0.15s' }}>
              {busy ? 'Saving…' : 'Set Password →'}
            </button>
          </form>
        )}

        {/* ── Sign in / Register / Reset forms ── */}
        {mode !== 'newpassword' && (
          <form onSubmit={mode === 'signin' ? handleSignIn : mode === 'reset' ? handleReset : handleRegister} noValidate>
            {/* Register-only: display name + username */}
            {mode === 'register' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Your Name</label>
                  <input value={displayName} onChange={e => { setDisplayName(e.target.value); setError(''); }} placeholder="e.g. Monica" autoFocus style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = '#C25B38'} onBlur={e => e.currentTarget.style.borderColor = 'rgba(212,167,113,0.4)'} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Username <span style={{ fontWeight: 400, opacity: 0.65, textTransform: 'none', letterSpacing: 0 }}>(optional — lets you sign in without email)</span></label>
                  <input value={username} onChange={e => { setUsername(e.target.value); setError(''); }} placeholder="e.g. sunnyray" autoComplete="username" style={inputStyle}
                    onFocus={e => e.currentTarget.style.borderColor = '#C25B38'} onBlur={e => e.currentTarget.style.borderColor = 'rgba(212,167,113,0.4)'} />
                </div>
              </>
            )}

            {/* Email / Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>{mode === 'signin' ? 'Email or Username' : 'Email'}</label>
              <input
                type={mode === 'signin' ? 'text' : 'email'}
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder={mode === 'signin' ? 'you@example.com or yourname' : 'you@example.com'}
                autoComplete="email"
                autoFocus={mode === 'signin'}
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = '#C25B38'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(212,167,113,0.4)'}
              />
            </div>

            {/* Password — hidden in reset mode */}
            {mode !== 'reset' && (
              <div style={{ marginBottom: mode === 'register' ? 16 : 20 }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder={mode === 'register' ? 'at least 6 characters' : '••••••••'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    style={{ ...inputStyle, paddingRight: 44, border: `1.5px solid ${error ? '#E05040' : 'rgba(212,167,113,0.4)'}` }}
                    onFocus={e => e.currentTarget.style.borderColor = '#C25B38'} onBlur={e => e.currentTarget.style.borderColor = error ? '#E05040' : 'rgba(212,167,113,0.4)'} />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#A07060', padding: 4 }}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            {/* Register-only: profile picker */}
            {mode === 'register' && (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Choose your profile</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PROFILES.map(p => {
                    const active = profile === p.key;
                    return (
                      <button key={p.key} type="button" onClick={() => setProfile(p.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${active ? p.border : 'var(--border-soft,#D6D1CA)'}`, background: active ? `${p.border}25` : 'transparent', transition: 'all 0.15s' }}>
                        <span style={{ fontSize: '0.95rem' }}>{p.emoji}</span>
                        <span style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.74rem', fontWeight: 700, color: active ? p.color : '#8A7060' }}>{p.display}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <div style={{ marginBottom: 16, fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.76rem', color: '#C03020', lineHeight: 1.4 }}>{error}</div>}

            <button type="submit" disabled={busy} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: busy ? 'rgba(194,91,56,0.4)' : '#C25B38', color: '#fff', fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1rem', fontWeight: 600, cursor: busy ? 'default' : 'pointer', boxShadow: busy ? 'none' : '0 4px 16px rgba(194,91,56,0.3)', transition: 'background 0.15s' }}>
              {busy
                ? (mode === 'signin' ? 'Signing in…' : mode === 'reset' ? 'Sending…' : 'Creating account…')
                : (mode === 'signin' ? 'Sign In →' : mode === 'reset' ? 'Send Reset Link →' : 'Create Account →')}
            </button>

            {mode === 'signin' && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button type="button" onClick={() => { setMode('reset'); setError(''); setNotice(''); }}
                  style={{ background: 'none', border: 'none', color: '#A07060', cursor: 'pointer', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.72rem', textDecoration: 'underline', padding: 0 }}>
                  Forgot password?
                </button>
              </div>
            )}

            {mode === 'reset' && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice(''); }}
                  style={{ background: 'none', border: 'none', color: '#A07060', cursor: 'pointer', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.72rem', textDecoration: 'underline', padding: 0 }}>
                  ← Back to sign in
                </button>
              </div>
            )}
          </form>
        )}

        {!isSubMode && (
          <p style={{ textAlign: 'center', marginTop: 18, fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.72rem', color: '#B09080', lineHeight: 1.5 }}>
            {mode === 'signin'
              ? <>New to the Well? <button type="button" onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: '#C25B38', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}>Create an account</button></>
              : <>Already have an account? <button type="button" onClick={() => { setMode('signin'); setError(''); }} style={{ background: 'none', border: 'none', color: '#C25B38', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}>Sign in</button></>}
          </p>
        )}
      </div>

      <style>{`@keyframes cr8w-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(3px)} }`}</style>
    </Screen>
  );
}
