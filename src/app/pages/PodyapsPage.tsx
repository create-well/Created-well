import React from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { isPodyap } from '../../lib/flows';
import { ReleaseStatusStrip } from '../components/ReleaseStatusStrip';
import { SessionsStrip } from '../components/making/SessionsStrip';
import { MakingQueues } from '../components/making/MakingQueues';
import { MakingBoard } from '../components/making/MakingBoard';

// ── Making (Phase 4, packet T) ──────────────────────────────────────────────
// The CONTENT production board: the next podyap session, the two
// waiting queues (Taste, Release Call), and the gate/status board —
// all fed by the src/lib/making.ts derivations over data.forum. The
// old sessions page's hero, upcoming/past lists, and PodyapCard
// machinery retire here; sessions survive as the slim strip.

const PODCAST_PLATFORMS = [
  { label: 'Spotify',        emoji: '🎵', href: 'https://open.spotify.com/show/0Tj253e1ZAE7vsKd4Tffvi',                                                                                color: '#1DB954' },
  { label: 'Apple Podcasts', emoji: '🎙️', href: 'https://podcasts.apple.com/us/podcast/brb-creating-well-a-create-well-podcast/id6795904154',                                        color: '#9B59E0' },
  { label: 'YouTube',        emoji: '▶️',  href: 'https://www.youtube.com/@brbcreatingwell',                                                                                           color: '#FF0000' },
  { label: 'Amazon Music',   emoji: '🎶', href: 'https://music.amazon.com/podcasts/e1ff7602-912c-488b-a11f-e6fb6027dbba',                                                             color: '#1AD0D3' },
  { label: 'Instagram',      emoji: '📸', href: 'https://www.instagram.com/brbcreatingwell',                                                                                          color: '#E1306C' },
];

export function PodyapsPage() {
  const { data, actions } = useDashboard();
  const navigate = useNavigate();

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' :
    'fresh';

  return (
    <ViewShell
      state={state}
      onRetry={actions.retrySync}
    >
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => navigate('/gatherings')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-label)',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--text-muted, #8A7060)',
              marginBottom: 8,
            }}
          >
            ← All gatherings
          </button>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            BRB Creating Well
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
            color: 'var(--cr8w-text, #2D2438)', margin: 0, letterSpacing: '-0.02em',
          }}>
            Making 🎙️
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.8rem',
            color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
          }}>
            Episodes and pieces, from topic to release.
          </p>
        </div>

        {/* Next podyap session + Preflight */}
        <SessionsStrip sessions={data.coFlowDates.filter(isPodyap)} />

        {/* Release status (G-11 Consumer 2) */}
        <ReleaseStatusStrip />

        {/* Waiting queues */}
        <MakingQueues posts={data.forum} />

        {/* Episodes + pieces board */}
        <MakingBoard posts={data.forum} />

        {/* Podcast platforms */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            Listen + follow
          </div>
          <div style={{
            background: 'var(--cr8w-card-bg, #F4F1ED)',
            border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {PODCAST_PLATFORMS.map((p, i) => (
              <a
                key={p.label}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: i < PODCAST_PLATFORMS.length - 1 ? '1px solid var(--border-soft, rgba(196,164,132,0.10))' : 'none',
                  textDecoration: 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(44,28,16,0.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1rem' }}>{p.emoji}</span>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                    color: 'var(--cr8w-text, #2D2438)',
                  }}>{p.label}</span>
                </span>
                <span style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.65rem',
                  color: p.color, fontWeight: 600, opacity: 0.8,
                }}>↗</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
