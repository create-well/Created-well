/**
 * HowWeFlowReference
 * Collapsible reference panel for the Geyser Overview tab.
 * Contains: Annual Anchors, Revenue/Team Pay, and a Continuity note.
 * No external component deps — imports only from data.ts and React.
 */
import React, { useState } from 'react';

// ── Annual Anchors ────────────────────────────────────────────────────────────
const ANCHORS = [
  {
    name: 'Winter Solstice Reset',
    icon: '❄️',
    when: 'Dec 21',
    bg: '#D8EDF8',
    border: '#A9D6F8',
    text: '#2E5A80',
    desc: 'Full team pause. Archive the year, clear the slate. Intentions for the next cycle are set in stillness — not hustle.',
    notes: [
      'Decomprocess the year as a team',
      'Archive completed Geyser notes',
      'Set Q1 intentions in Cohoe',
    ],
  },
  {
    name: 'Spring Equinox',
    icon: '🌱',
    when: 'Mar 20',
    bg: '#DCF0D4',
    border: '#B8D4A8',
    text: '#2E5A2E',
    desc: 'Geyser season opens. The Spring Equinox marks the start of the primary event window — schedule the first Geyser of the year here.',
    notes: [
      'Open Studio series begins',
      'Geyser event territory starts',
      'Outreach push goes live',
    ],
  },
];

// ── Revenue / Team Pay ────────────────────────────────────────────────────────
const REVENUE_ROWS = [
  {
    label: 'Event Revenue Split',
    value: '50 / 50',
    desc: 'CR8W house vs. team pot — after venue costs clear',
  },
  {
    label: 'Team Pot',
    value: 'Equal shares',
    desc: 'Divided equally among active contributors for that event',
  },
  {
    label: 'Pay Window',
    value: '7 days',
    desc: 'All team pay processed within 7 days of funds clearing',
  },
];

const SPONSOR_TIERS = [
  { tier: 'Seed',  range: '$250–$499', cut: '10% to CR8W Ops', bg: '#DCF0D4', border: '#B8D4A8', text: '#2E5A2E' },
  { tier: 'Root',  range: '$500–$999', cut: '15% to CR8W Ops', bg: '#F0E6CC', border: '#D4C4A0', text: '#5A4020' },
  { tier: 'Bloom', range: '$1,000+',   cut: '20% to CR8W Ops', bg: '#FFDEC2', border: '#E8AF93', text: '#7A3A10' },
];

// ── Sub-component: Continuity note ────────────────────────────────────────────
function ContinuityNote() {
  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'rgba(123,168,157,0.06)',
        border: '1px solid rgba(123,168,157,0.25)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-label, "Blinker", sans-serif)',
          fontSize: '0.78rem',
          fontWeight: 700,
          color: '#5F8D82',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        🌿 The System Holds Itself
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body, "Montserrat", sans-serif)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary, #443855)',
          lineHeight: 1.6,
          margin: '0 0 10px',
        }}
      >
        Many faces, not one. CR8W is built on distributed ownership — no single absence stalls the flow.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: '☀️ Sunshine away', note: 'Content queue, advance builds, and sponsor threads continue — scheduled work runs itself.' },
          { label: '✨ Bingle away',    note: 'Space-holding flexes to co-leads. Workshops proceed with the prepared brief.' },
          { label: '🌊 Monica away',   note: 'Monica is an open invitation — outreach and systems are never assumed. Nothing waits on one person.' },
          { label: '🎪 Event Support', note: 'Day-of roles are transferable. Briefing doc in The Well covers setup and cleanup.' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span
              style={{
                fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#7BA89D',
                whiteSpace: 'nowrap',
                paddingTop: 1,
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body, "Montserrat", sans-serif)',
                fontSize: '0.7rem',
                color: 'var(--text-muted, #6B5F7A)',
                lineHeight: 1.45,
              }}
            >
              {row.note}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 10,
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(123,168,157,0.1)',
          fontFamily: 'var(--font-label, "Blinker", sans-serif)',
          fontSize: '0.63rem',
          color: '#5F8D82',
          lineHeight: 1.5,
        }}
      >
        🔄 Supabase autosync runs every 15 s — all changes persist across devices automatically.
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function HowWeFlowReference() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<'anchors' | 'revenue' | 'continuity'>('anchors');

  return (
    <div
      style={{
        marginTop: 24,
        borderRadius: 14,
        border: '1px solid rgba(212,167,113,0.24)',
        overflow: 'hidden',
        background: 'rgba(244,241,237,0.6)',
      }}
    >
      {/* ── Toggle header ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="hwf-panel"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 18px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          gap: 10,
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1rem' }}>📖</span>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display, "Fredoka", sans-serif)',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#C25B38',
                lineHeight: 1.2,
              }}
            >
              How We Flow — Reference
            </div>
            <div
              style={{
                fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                fontSize: '0.62rem',
                color: 'var(--text-muted, #6B5F7A)',
                letterSpacing: '0.02em',
                marginTop: 2,
              }}
            >
              Annual Anchors · Revenue &amp; Pay · Continuity
            </div>
          </div>
        </div>
        <span
          aria-hidden="true"
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted, #6B5F7A)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {/* ── Panel body ─────────────────────────────────────────────────────── */}
      {open && (
        <div id="hwf-panel" style={{ borderTop: '1px solid rgba(212,167,113,0.2)', padding: '0 18px 20px' }}>

          {/* Section tabs */}
          <div style={{ display: 'flex', gap: 6, margin: '14px 0 18px', flexWrap: 'wrap' }}>
            {([
              { key: 'anchors',    label: '🗓 Annual Anchors' },
              { key: 'revenue',    label: '💰 Revenue & Pay' },
              { key: 'continuity', label: '🌿 Continuity' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setSection(tab.key)}
                style={{
                  padding: '5px 13px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                  fontSize: '0.71rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  background: section === tab.key ? '#C25B38' : 'rgba(194,91,56,0.09)',
                  color: section === tab.key ? '#fff' : '#C25B38',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Annual Anchors ──────────────────────────────────────────────── */}
          {section === 'anchors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ANCHORS.map(a => (
                <div
                  key={a.name}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${a.border}`,
                    background: a.bg,
                    padding: '13px 15px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '1.1rem' }}>{a.icon}</span>
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display, "Fredoka", sans-serif)',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: a.text,
                          lineHeight: 1.2,
                        }}
                      >
                        {a.name}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                          fontSize: '0.62rem',
                          color: a.text,
                          opacity: 0.7,
                          marginTop: 1,
                        }}
                      >
                        {a.when} each year
                      </div>
                    </div>
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body, "Montserrat", sans-serif)',
                      fontSize: '0.77rem',
                      color: a.text,
                      lineHeight: 1.55,
                      margin: '0 0 10px',
                      opacity: 0.85,
                    }}
                  >
                    {a.desc}
                  </p>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {a.notes.map(n => (
                      <li
                        key={n}
                        style={{
                          fontFamily: 'var(--font-body, "Montserrat", sans-serif)',
                          fontSize: '0.73rem',
                          color: a.text,
                          lineHeight: 1.4,
                          opacity: 0.9,
                        }}
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p
                style={{
                  margin: 0,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(212,167,113,0.1)',
                  border: '1px solid rgba(212,167,113,0.2)',
                  fontFamily: 'var(--font-body, "Montserrat", sans-serif)',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #6B5F7A)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                These are energetic anchors, not hard deadlines. The rhythm bends to real life — what matters is returning to them each cycle.
              </p>
            </div>
          )}

          {/* ── Revenue & Pay ───────────────────────────────────────────────── */}
          {section === 'revenue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Splits */}
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    color: 'var(--text-muted, #6B5F7A)',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Event Revenue
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {REVENUE_ROWS.map(r => (
                    <div
                      key={r.label}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: '#fff',
                        border: '1px solid var(--border-soft, #D6D1CA)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--text-primary, #2D2438)',
                            marginBottom: 2,
                          }}
                        >
                          {r.label}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-body, "Montserrat", sans-serif)',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted, #6B5F7A)',
                            lineHeight: 1.4,
                          }}
                        >
                          {r.desc}
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display, "Fredoka", sans-serif)',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: '#C25B38',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {r.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sponsor tiers */}
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                    fontSize: '0.67rem',
                    fontWeight: 700,
                    color: 'var(--text-muted, #6B5F7A)',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Sponsor Tiers
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SPONSOR_TIERS.map(t => (
                    <div
                      key={t.tier}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 14px',
                        borderRadius: 8,
                        background: t.bg,
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display, "Fredoka", sans-serif)',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          color: t.text,
                          minWidth: 44,
                        }}
                      >
                        {t.tier}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                          fontSize: '0.73rem',
                          color: t.text,
                          flex: 1,
                        }}
                      >
                        {t.range}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-label, "Blinker", sans-serif)',
                          fontSize: '0.68rem',
                          color: t.text,
                          opacity: 0.8,
                        }}
                      >
                        {t.cut}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: '9px 13px',
                  borderRadius: 8,
                  background: 'rgba(194,91,56,0.07)',
                  border: '1px solid rgba(194,91,56,0.18)',
                  fontFamily: 'var(--font-body, "Montserrat", sans-serif)',
                  fontSize: '0.74rem',
                  color: '#C25B38',
                  lineHeight: 1.55,
                }}
              >
                💸 All team pay is processed within <strong>7 days</strong> of funds clearing. No chasing — the system pays when it receives.
              </div>
            </div>
          )}

          {/* ── Continuity ──────────────────────────────────────────────────── */}
          {section === 'continuity' && <ContinuityNote />}
        </div>
      )}
    </div>
  );
}
