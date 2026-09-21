import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import type { CoFlowDate } from '../components/api';
import { FlowCommandCenter } from '../components/FlowCommandCenter';
import { isPodyap } from '../../lib/flows';

const PODCAST_PLATFORMS = [
  { label: 'Spotify',        emoji: '🎵', href: 'https://open.spotify.com/show/0Tj253e1ZAE7vsKd4Tffvi',                                                                                color: '#1DB954' },
  { label: 'Apple Podcasts', emoji: '🎙️', href: 'https://podcasts.apple.com/us/podcast/brb-creating-well-a-create-well-podcast/id6795904154',                                        color: '#9B59E0' },
  { label: 'YouTube',        emoji: '▶️',  href: 'https://www.youtube.com/@brbcreatingwell',                                                                                           color: '#FF0000' },
  { label: 'Amazon Music',   emoji: '🎶', href: 'https://music.amazon.com/podcasts/e1ff7602-912c-488b-a11f-e6fb6027dbba',                                                             color: '#1AD0D3' },
  { label: 'Instagram',      emoji: '📸', href: 'https://www.instagram.com/brbcreatingwell',                                                                                          color: '#E1306C' },
];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    scheduled:  { bg: 'rgba(123,168,157,0.15)', color: '#4A8A7D' },
    happened:   { bg: 'rgba(44,28,16,0.06)',    color: '#8A7D72' },
    wrapped:    { bg: 'rgba(44,28,16,0.06)',    color: '#8A7D72' },
    upcoming:   { bg: 'rgba(184,169,212,0.18)', color: '#7A5FA0' },
    approved:   { bg: 'rgba(123,168,157,0.12)', color: '#4A8A7D' },
    cancelled:  { bg: 'rgba(255,69,58,0.10)',   color: '#CC3B2F' },
  };
  const { bg, color } = map[status] ?? { bg: 'rgba(44,28,16,0.06)', color: '#8A7D72' };
  return (
    <span style={{
      background: bg, color, borderRadius: 6,
      padding: '2px 7px',
      fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

function PodyapCard({ p, expanded, onToggle }: { p: CoFlowDate; expanded: boolean; onToggle: () => void }) {
  const days = daysUntil(p.date);
  const isPast = days < 0;
  const isToday = days === 0;
  const themeLabel = (p.theme || '').toLowerCase() === 'yapcast' ? 'Yapcast' : 'Playdate';

  return (
    <div
      onClick={onToggle}
      style={{
        background: expanded ? 'var(--cr8w-surface, #FFF8F2)' : '#fff',
        border: `1.5px solid ${expanded ? 'rgba(184,169,212,0.35)' : 'rgba(44,28,16,0.07)'}`,
        borderRadius: 14,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Date chip */}
        <div style={{
          flexShrink: 0,
          background: isToday ? '#7BA89D' : isPast ? 'rgba(44,28,16,0.05)' : 'rgba(184,169,212,0.15)',
          color: isToday ? '#fff' : isPast ? 'var(--text-muted)' : '#7A5FA0',
          borderRadius: 8, padding: '5px 10px',
          fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
          textAlign: 'center', minWidth: 52,
        }}>
          <div>{new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
          <div style={{ fontSize: '1rem', lineHeight: 1.1 }}>
            {new Date(p.date + 'T00:00:00').getDate()}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
              color: '#9B59E0', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{themeLabel}</span>
            <StatusPill status={p.status} />
          </div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.85rem',
            color: 'var(--cr8w-text, #2D2438)', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {p.notes || p.theme || 'No title yet'}
          </div>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.62rem',
            color: 'var(--text-muted)', marginTop: 2,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            {p.timeRange && <span>🕐 {p.timeRange}</span>}
            {p.location && <span>📍 {p.location}</span>}
            {!isPast && days <= 7 && days >= 0 && (
              <span style={{ color: '#7BA89D', fontWeight: 600 }}>
                {isToday ? 'Today!' : `${days}d away`}
              </span>
            )}
          </div>
        </div>

        <span style={{
          fontSize: '0.6rem', color: 'var(--text-muted)',
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(44,28,16,0.06)',
          marginTop: 10, paddingTop: 10,
          display: 'flex', flexDirection: 'column', gap: 6,
          animation: 'podyap-in 0.15s ease',
        }}>
          <style>{`@keyframes podyap-in { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }`}</style>

          {p.vibeCheck && (
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.78rem',
              color: '#7A5FA0', fontStyle: 'italic',
            }}>
              "{p.vibeCheck}"
            </div>
          )}

          {p.agendaItems && p.agendaItems.length > 0 && (
            <div>
              <div style={{
                fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 700,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 4,
              }}>Agenda</div>
              {p.agendaItems.map((item, i) => (
                <div key={i} style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.76rem',
                  color: 'var(--cr8w-text, #2D2438)',
                  padding: '3px 0',
                  borderBottom: i < p.agendaItems.length - 1 ? '1px solid rgba(44,28,16,0.04)' : 'none',
                }}>
                  {i + 1}. {typeof item === 'string' ? item : (item as any).text || JSON.stringify(item)}
                </div>
              ))}
            </div>
          )}

          {p.sessionNotes && (
            <div style={{
              background: 'rgba(184,169,212,0.08)', borderRadius: 8, padding: '8px 10px',
              fontFamily: 'var(--font-body)', fontSize: '0.76rem',
              color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.5,
            }}>
              📝 {p.sessionNotes}
            </div>
          )}

          {p.host && (
            <div style={{
              fontFamily: 'var(--font-label)', fontSize: '0.62rem',
              color: 'var(--text-muted)',
            }}>
              Hosted by <strong style={{ color: 'var(--cr8w-text)' }}>{p.host}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PodyapsPage() {
  const { data, actions } = useDashboard();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' : 'fresh';

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const allPodyaps = data.coFlowDates.filter(isPodyap);
  const upcoming = allPodyaps
    .filter(p => new Date(p.date + 'T00:00:00') >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = allPodyaps
    .filter(p => new Date(p.date + 'T00:00:00') < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const next = upcoming[0] ?? null;
  const nextDays = next ? daysUntil(next.date) : null;

  return (
    <ViewShell
      state={state}
      emptyTitle="No podyaps scheduled"
      emptyBody="Add a CoFlow date with theme 'yapcast' or 'playdate' in Notion to get started."
      onRetry={actions.retrySync}
    >
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => navigate('/flows')}
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
            ← All events (/flows)
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
            Podyaps 🎙️
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.8rem',
            color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
          }}>
            Yapcasts · Playdates · recording sessions
          </p>
        </div>

        {/* Podyap Preflight (Omar's Operations Room) */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setShowPreflight(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 14,
              border: showPreflight
                ? '1.5px solid #C25B38'
                : '1px solid var(--border-soft, rgba(196,164,132,0.25))',
              background: showPreflight
                ? 'rgba(194,91,56,0.06)'
                : 'var(--cr8w-card-bg, #F4F1ED)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: showPreflight ? '#C25B38' : 'var(--cr8w-text, #2D2438)',
                }}>
                  Podyap Preflight (Omar's Operations Room)
                </div>
                <div style={{
                  fontFamily: 'var(--font-label)',
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                }}>
                  Rhythm strip · Episode roles · Live gear · Weeecording timeline
                </div>
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--font-label)',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: showPreflight ? '#C25B38' : 'var(--text-muted)',
            }}>
              {showPreflight ? 'Collapse ▲' : 'Open ▼'}
            </span>
          </button>

          {showPreflight && (
            <div style={{ marginTop: 16 }}>
              <FlowCommandCenter />
            </div>
          )}
        </div>

        {/* Next podyap hero — only if upcoming */}
        {next && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(184,169,212,0.18) 0%, rgba(123,168,157,0.10) 100%)',
            border: '1.5px solid rgba(184,169,212,0.3)',
            borderRadius: 16,
            padding: '16px 18px',
            marginBottom: 20,
          }}>
            <div style={{
              fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#9B59E0', marginBottom: 6,
            }}>
              {nextDays === 0 ? '🎙️ Recording today' : nextDays === 1 ? '📅 Tomorrow' : `📅 In ${nextDays} days`}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800,
              color: 'var(--cr8w-text, #2D2438)', marginBottom: 4,
            }}>
              {next.notes || next.theme || 'Podyap'}
            </div>
            <div style={{
              fontFamily: 'var(--font-label)', fontSize: '0.68rem',
              color: 'var(--text-muted)', display: 'flex', gap: 12,
            }}>
              <span>📆 {formatDate(next.date)}</span>
              {next.timeRange && <span>🕐 {next.timeRange}</span>}
              {next.location && <span>📍 {next.location}</span>}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={() => navigate('/care')}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: '#9B59E0', color: '#fff',
                  fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                }}
              >
                Open CoFlow D8s
              </button>
              <button
                onClick={() => setExpandedId(expandedId === next.id ? null : next.id)}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: 'rgba(155,89,224,0.10)',
                  color: '#9B59E0',
                  fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
                  border: '1px solid rgba(155,89,224,0.25)', cursor: 'pointer',
                }}
              >
                {expandedId === next.id ? 'Collapse' : 'View details'}
              </button>
            </div>

            {expandedId === next.id && next.agendaItems && next.agendaItems.length > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: 10 }}>
                <div style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.58rem', fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: 4,
                }}>Agenda</div>
                {next.agendaItems.map((item, i) => (
                  <div key={i} style={{
                    fontFamily: 'var(--font-body)', fontSize: '0.76rem',
                    color: 'var(--cr8w-text)', padding: '3px 0',
                    borderBottom: i < next.agendaItems.length - 1 ? '1px solid rgba(44,28,16,0.06)' : 'none',
                  }}>
                    {i + 1}. {typeof item === 'string' ? item : (item as any).text || JSON.stringify(item)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No upcoming fallback */}
        {upcoming.length === 0 && (
          <div style={{
            background: 'rgba(184,169,212,0.08)',
            border: '1.5px dashed rgba(184,169,212,0.3)',
            borderRadius: 14, padding: '20px',
            textAlign: 'center', marginBottom: 20,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎙️</div>
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.85rem',
              color: 'var(--cr8w-text, #2D2438)', marginBottom: 4,
            }}>No podyaps scheduled yet</div>
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.75rem',
              color: 'var(--text-muted)', marginBottom: 12,
            }}>
              Add a CoFlow date in Notion with theme "yapcast" or "playdate"
            </div>
            <button
              onClick={() => navigate('/care')}
              style={{
                padding: '8px 18px', borderRadius: 8,
                background: '#9B59E0', color: '#fff',
                fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
                border: 'none', cursor: 'pointer',
              }}
            >
              Open CoFlow D8s →
            </button>
          </div>
        )}

        {/* Upcoming podyaps (beyond the hero) */}
        {upcoming.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--text-muted)', marginBottom: 8,
            }}>
              Upcoming
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.slice(1).map(p => (
                <PodyapCard
                  key={p.id}
                  p={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                />
              ))}
            </div>
          </div>
        )}

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

        {/* Past podyaps */}
        {past.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px',
                fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{
                transition: 'transform 0.15s',
                transform: showPast ? 'rotate(90deg)' : 'rotate(0deg)',
                display: 'inline-block',
              }}>▶</span>
              Past podyaps ({past.length})
            </button>

            {showPast && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map(p => (
                  <PodyapCard
                    key={p.id}
                    p={p}
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ViewShell>
  );
}
