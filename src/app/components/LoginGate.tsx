/**
 * CR8W Create Well — Login Gate (clear, guided UX)
 *
 * Step 1 : Team password  (default: "createwell" — override with VITE_APP_PASSWORD_HASH)
 * Step 2 : Who are you?   (pick a profile — or set a custom name for new members)
 *
 * Storage
 *   localStorage  cr8w_auth_persistent = '1'   remember me across sessions
 *   sessionStorage cr8w_auth_session   = '1'   this tab only
 *   localStorage  cr8w_user_profile    = key   chosen profile key
 */
import React, { useState, useCallback } from 'react';
import cwLogoImg from 'figma:asset/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png';

// ── Default password ──────────────────────────────────────────────────────────
// SHA-256 of "createwell" — set VITE_APP_PASSWORD_HASH to change it
const DEFAULT_HASH = '625201befb1355e692947dafb5bd855245679d2d40c19eb4745e9dca302a2016';
const STORED_HASH: string = (import.meta.env.VITE_APP_PASSWORD_HASH as string | undefined) ?? DEFAULT_HASH;

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export const PROFILES = [
  { key: 'sunshine',      emoji: '☀️', display: 'Sunshine',      role: 'Remote',           desc: 'Advance building · Content · Sponsor comms',      color: '#C25B38', bg: '#FFF0EB', border: '#F2B49B' },
  { key: 'monny',         emoji: '🌊', display: 'Monica (Monny)', role: 'Open Invitation',  desc: 'Outreach · Systems · Bridge building',             color: '#2A6A9A', bg: '#EAF4FC', border: '#A9D6F8' },
  { key: 'bingle',        emoji: '✨', display: 'Bingle',         role: 'In-Person',         desc: 'Space-holding · Community · Workshops',            color: '#7A5010', bg: '#FFF8EC', border: '#D4A771' },
  { key: 'omar',          emoji: '🌟', display: 'Omar',           role: 'New Member',        desc: 'Community · Creative collaboration · Fresh energy', color: '#5C4A9A', bg: '#F0ECFB', border: '#B8A9D4' },
  { key: 'event-support', emoji: '🎪', display: 'Event Support',  role: 'Day-Of',            desc: 'Setup · Cleanup · Engagement',                    color: '#7A4A20', bg: '#FFF5EE', border: '#E8AF93' },
];

// ── Auth state helpers ────────────────────────────────────────────────────────
export function isAuthenticated(): boolean {
  try {
    if (sessionStorage.getItem('cr8w_auth_session') === '1') return true;
    if (localStorage.getItem('cr8w_auth_persistent') === '1') return true;
    return false;
  } catch { return false; }
}

export function getStoredProfile(): string | null {
  try { return localStorage.getItem('cr8w_user_profile'); } catch { return null; }
}

export function clearAuth(): void {
  try {
    sessionStorage.removeItem('cr8w_auth_session');
    localStorage.removeItem('cr8w_auth_persistent');
  } catch {}
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { onAuthenticated: (profileKey: string) => void; }
type Step = 'password' | 'profile';

// Shared card / glow wrapper
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#FAF6F2 0%,#F4EDE6 40%,#EDE4DA 100%)', padding: '24px 16px', fontFamily: 'var(--font-body,"Montserrat",sans-serif)' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(194,91,56,0.12) 0%,transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(123,168,157,0.14) 0%,transparent 70%)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>{children}</div>
    </div>
  );
}

export function LoginGate({ onAuthenticated }: Props) {
  const [step, setStep] = useState<Step>('password');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(false);
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true); setTimeout(() => setShake(false), 600);
  }, []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw.trim()) return;
    setChecking(true);
    setError('');
    try {
      const hash = await sha256hex(pw.trim());
      if (hash !== STORED_HASH) {
        setError('Incorrect password — see the hint above for the default.');
        setPw('');
        setShowHint(true);
        triggerShake();
        return;
      }
      if (remember) localStorage.setItem('cr8w_auth_persistent', '1');
      sessionStorage.setItem('cr8w_auth_session', '1');
      const stored = localStorage.getItem('cr8w_user_profile');
      if (stored && PROFILES.some(p => p.key === stored)) {
        onAuthenticated(stored);
      } else {
        setStep('profile');
      }
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setChecking(false);
    }
  }

  function handleProfileSelect(key: string) {
    const finalKey = key === '__custom__' ? (customName.trim() || 'new-member') : key;
    localStorage.setItem('cr8w_user_profile', finalKey);
    onAuthenticated(finalKey);
  }

  // ── Step 1: Password ─────────────────────────────────────────────────────
  if (step === 'password') {
    return (
      <Screen>
        <div style={{ maxWidth: 400, margin: '0 auto', background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(14px)', borderRadius: 24, boxShadow: '0 8px 40px rgba(194,91,56,0.12),0 2px 8px rgba(0,0,0,0.06)', padding: '40px 32px 32px', border: '1px solid rgba(212,167,113,0.25)', animation: shake ? 'cr8w-shake 0.55s ease' : 'none' }}>

          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src={cwLogoImg} alt="Create Well" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 12, boxShadow: '0 4px 16px rgba(194,91,56,0.2)' }} />
            <div style={{ fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1.9rem', fontWeight: 700, color: '#C25B38', lineHeight: 1 }}>Create Well</div>
            <div style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.72rem', color: '#A07060', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>CR8W Dashboard</div>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#C25B38' }} />
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(194,91,56,0.2)' }} />
            <span style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.62rem', color: '#A07060', letterSpacing: '0.06em' }}>STEP 1 OF 2</span>
          </div>

          <form onSubmit={handlePasswordSubmit} noValidate>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <label style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.72rem', fontWeight: 700, color: '#A07060', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Team Password
                </label>
                <button type="button" onClick={() => setShowHint(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.68rem', color: '#C25B38', textDecoration: 'underline', padding: 0 }}>
                  Need help?
                </button>
              </div>

              {/* Hint box */}
              {showHint && (
                <div style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(194,91,56,0.07)', border: '1px solid rgba(194,91,56,0.2)', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.75rem', color: '#8A4020', lineHeight: 1.5 }}>
                  💡 <strong>Default password:</strong> <code style={{ background: 'rgba(194,91,56,0.12)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', letterSpacing: '0.05em' }}>createwell</code>
                  <br />
                  <span style={{ opacity: 0.75 }}>Your team admin can change this via the <code>VITE_APP_PASSWORD_HASH</code> env var.</span>
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={e => { setPw(e.target.value); setError(''); }}
                  placeholder="enter team password"
                  autoFocus
                  autoComplete="current-password"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', borderRadius: 10, border: `1.5px solid ${error ? '#E05040' : 'rgba(212,167,113,0.4)'}`, background: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.95rem', color: '#2D2438', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#C25B38'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = error ? '#E05040' : 'rgba(212,167,113,0.4)'; }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#A07060', padding: 4 }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
              {error && <div style={{ marginTop: 8, fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.74rem', color: '#C03020', lineHeight: 1.4 }}>{error}</div>}
            </div>

            {/* Remember me */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
              <div onClick={() => setRemember(v => !v)} role="checkbox" aria-checked={remember} tabIndex={0} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') setRemember(v => !v); }} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${remember ? '#C25B38' : 'rgba(160,112,96,0.35)'}`, background: remember ? '#C25B38' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', cursor: 'pointer' }}>
                {remember && <span style={{ color: '#fff', fontSize: '0.7rem', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.75rem', color: '#8A6A5A', userSelect: 'none' }}>Keep me signed in on this device</span>
            </label>

            <button type="submit" disabled={checking || !pw.trim()} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: checking || !pw.trim() ? 'rgba(194,91,56,0.35)' : '#C25B38', color: '#fff', fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1rem', fontWeight: 600, cursor: checking || !pw.trim() ? 'default' : 'pointer', boxShadow: checking || !pw.trim() ? 'none' : '0 4px 16px rgba(194,91,56,0.3)', transition: 'background 0.15s' }}>
              {checking ? 'Checking…' : 'Continue →'}
            </button>
          </form>
        </div>

        <style>{`@keyframes cr8w-shake { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-8px)} 30%{transform:translateX(7px)} 45%{transform:translateX(-6px)} 60%{transform:translateX(5px)} 75%{transform:translateX(-3px)} 90%{transform:translateX(2px)} }`}</style>
      </Screen>
    );
  }

  // ── Step 2: Profile selection ─────────────────────────────────────────────
  return (
    <Screen>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#C25B38' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#C25B38' }} />
          <span style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.62rem', color: '#A07060', letterSpacing: '0.06em' }}>STEP 2 OF 2</span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1.75rem', fontWeight: 700, color: '#C25B38' }}>Who are you?</div>
        </div>
        <p style={{ textAlign: 'center', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.8rem', color: '#8A6A5A', lineHeight: 1.6, margin: '0 0 20px' }}>
          Pick your profile — this sets your chat identity and personalizes the dashboard.<br />
          <strong>You can switch at any time</strong> inside the app.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PROFILES.map(p => (
            <button
              key={p.key}
              onClick={() => handleProfileSelect(p.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${p.border}`, background: p.bg, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 6px 18px ${p.border}55`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)'; }}
            >
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: `${p.border}40`, border: `2px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1rem', fontWeight: 600, color: p.color }}>{p.display}</div>
                <div style={{ fontFamily: 'var(--font-label,"Blinker",sans-serif)', fontSize: '0.62rem', fontWeight: 700, color: p.color, opacity: 0.7, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.role}</div>
                <div style={{ fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.7rem', color: '#8A7060', marginTop: 1 }}>{p.desc}</div>
              </div>
              <span style={{ color: p.color, opacity: 0.5, fontSize: '1rem', flexShrink: 0 }}>→</span>
            </button>
          ))}

          {/* "I'm someone new" custom name option */}
          <div style={{ marginTop: 4, padding: '14px 18px', borderRadius: 14, border: '1.5px dashed rgba(123,168,157,0.45)', background: 'rgba(123,168,157,0.04)' }}>
            <button type="button" onClick={() => setShowCustom(v => !v)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(123,168,157,0.15)', border: '2px dashed rgba(123,168,157,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🌱</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '1rem', fontWeight: 600, color: '#5F8D82' }}>I'm someone new</div>
                <div style={{ fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.7rem', color: '#8A9090' }}>Set a custom name to get started</div>
              </div>
              <span style={{ color: '#5F8D82', opacity: 0.6, fontSize: '1rem', flexShrink: 0 }}>{showCustom ? '↑' : '→'}</span>
            </button>

            {showCustom && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Your name or handle"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && customName.trim()) handleProfileSelect('__custom__'); }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(123,168,157,0.4)', background: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-body,"Montserrat",sans-serif)', fontSize: '0.88rem', color: '#2D2438', outline: 'none' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#7BA89D'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(123,168,157,0.4)'; }}
                />
                <button onClick={() => handleProfileSelect('__custom__')} disabled={!customName.trim()} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: customName.trim() ? '#7BA89D' : 'rgba(123,168,157,0.3)', color: '#fff', fontFamily: 'var(--font-display,"Fredoka",sans-serif)', fontSize: '0.88rem', fontWeight: 600, cursor: customName.trim() ? 'pointer' : 'default', transition: 'background 0.15s' }}>
                  Enter →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
