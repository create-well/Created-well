import React from 'react';

export type ViewState = 'loading' | 'empty' | 'stale' | 'failed' | 'restricted';

interface ViewShellProps {
  state: ViewState;
  children?: React.ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  restrictedTitle?: string;
  restrictedBody?: string;
  failedTitle?: string;
  failedBody?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ViewShell({
  state,
  children,
  emptyTitle = 'Nothing here yet',
  emptyBody = 'This space is clear — that\'s a valid starting point.',
  restrictedTitle = 'Access restricted',
  restrictedBody = 'You need permission to view this content.',
  failedTitle = 'Could not load',
  failedBody = 'The sync failed. Your last-known data may still be usable.',
  onRetry,
  compact = false,
}: ViewShellProps) {
  const pad = compact ? '24px 16px' : '48px 24px';

  if (state === 'loading') {
    return (
      <div style={{ padding: pad, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[80, 55, 100, 65, 90].map((w, i) => (
          <div
            key={i}
            className="skeleton-bar"
            style={{ width: `${w}%`, height: i === 0 ? 28 : 16, borderRadius: 8 }}
          />
        ))}
      </div>
    );
  }

  if (state === 'restricted') {
    return (
      <div style={{
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
      }}>
        <div style={{ fontSize: compact ? '1.8rem' : '2.5rem', lineHeight: 1 }}>🔒</div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: compact ? '0.9rem' : '1.1rem',
          fontWeight: 600,
          color: 'var(--cr8w-text, #2D2438)',
        }}>
          {restrictedTitle}
        </div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8rem',
          color: 'var(--text-muted, #6B5F7A)',
          maxWidth: 300,
          lineHeight: 1.5,
        }}>
          {restrictedBody}
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div style={{
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
      }}>
        <div style={{ fontSize: compact ? '1.8rem' : '2.5rem', lineHeight: 1 }}>⚠️</div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: compact ? '0.9rem' : '1.1rem',
          fontWeight: 600,
          color: 'var(--cr8w-text, #2D2438)',
        }}>
          {failedTitle}
        </div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.8rem',
          color: 'var(--text-muted, #6B5F7A)',
          maxWidth: 300,
          lineHeight: 1.5,
        }}>
          {failedBody}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 4,
              padding: '7px 18px',
              borderRadius: 8,
              background: 'var(--cr8w-primary, #7BA89D)',
              color: '#fff',
              fontFamily: 'var(--font-label)',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry sync
          </button>
        )}
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div style={{
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
      }}>
        <div style={{ fontSize: compact ? '1.8rem' : '2.5rem', lineHeight: 1 }}>💧</div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: compact ? '0.9rem' : '1.05rem',
          fontWeight: 600,
          color: 'var(--cr8w-text, #2D2438)',
        }}>
          {emptyTitle}
        </div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.78rem',
          color: 'var(--text-muted, #6B5F7A)',
          maxWidth: 280,
          lineHeight: 1.55,
        }}>
          {emptyBody}
        </div>
      </div>
    );
  }

  // stale: show content with a banner above
  return (
    <>
      {state === 'stale' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px',
          background: 'rgba(255, 159, 10, 0.08)',
          borderBottom: '1px solid rgba(255, 159, 10, 0.2)',
          fontSize: '0.68rem',
          fontFamily: 'var(--font-label)',
          color: '#FF9F0A',
          letterSpacing: '0.02em',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF9F0A', flexShrink: 0 }} />
          Data may be stale — last sync was a while ago
        </div>
      )}
      {children}
    </>
  );
}
