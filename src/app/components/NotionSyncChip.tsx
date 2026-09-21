import React, { useState } from 'react';
import { Check, AlertTriangle, CloudOff, RefreshCw, X, HelpCircle } from 'lucide-react';
import type { NotionSyncResult } from './api';

interface NotionSyncChipProps {
  sync?: NotionSyncResult;
  onRetry?: () => void;
  className?: string;
  showQuietWritten?: boolean;
}

export function NotionSyncChip({ sync, onRetry, className, showQuietWritten = true }: NotionSyncChipProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!sync) return null;

  const { state, db, message, dropped } = sync;

  // 1. Written: Notion has it
  if (state === 'written') {
    if (!showQuietWritten) return null;
    return (
      <span
        className={className}
        title={db ? `Synced to Notion ${db}` : 'Synced to Notion'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '1px 6px',
          borderRadius: 10,
          background: 'rgba(107, 175, 107, 0.12)',
          color: '#3A7A3A',
          fontFamily: 'var(--font-label)',
          fontSize: '0.62rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
          verticalAlign: 'middle',
        }}
      >
        <Check size={10} strokeWidth={2.5} />
        <span>synced</span>
      </span>
    );
  }

  // 2. Partial: Saved to KV, but some fields were dropped by Notion schema
  if (state === 'partial') {
    const droppedCount = dropped?.length || 1;
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
          className={className}
          title="Saved locally. Some fields could not be matched in Notion. Click for details."
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(212, 167, 113, 0.18)',
            border: '1px solid rgba(212, 167, 113, 0.4)',
            color: '#8A6A20',
            fontFamily: 'var(--font-label)',
            fontSize: '0.62rem',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          <AlertTriangle size={10} />
          <span>saved · {droppedCount} field{droppedCount !== 1 ? 's' : ''} did not fit</span>
        </button>

        {showDetails && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              width: 220,
              background: 'var(--bg-card, #FFFFFF)',
              border: '1px solid var(--border-soft, #E0DBD5)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              borderRadius: 8,
              padding: 10,
              zIndex: 40,
              fontSize: '0.72rem',
              color: 'var(--text-primary, #2D2A26)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: '#8A6A20' }}>Unmatched Notion Fields</span>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={12} />
              </button>
            </div>
            {dropped && dropped.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 14, lineHeight: 1.4 }}>
                {dropped.map((d, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{d.property}</strong>: {d.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, lineHeight: 1.4 }}>
                {message || 'Some properties were dropped to preserve database integrity.'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. Failed: Saved in KV, but Notion write rejected
  if (state === 'failed') {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
          className={className}
          title="Saved here, but rejected by Notion. Click for details and retry."
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(212, 107, 107, 0.15)',
            border: '1px solid rgba(212, 107, 107, 0.4)',
            color: '#A83B3B',
            fontFamily: 'var(--font-label)',
            fontSize: '0.62rem',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          <AlertTriangle size={10} />
          <span>saved here, not in Notion</span>
        </button>

        {showDetails && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              width: 240,
              background: 'var(--bg-card, #FFFFFF)',
              border: '1px solid rgba(212, 107, 107, 0.3)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              borderRadius: 8,
              padding: 10,
              zIndex: 40,
              fontSize: '0.72rem',
              color: 'var(--text-primary, #2D2A26)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: '#A83B3B' }}>Notion Sync Notice</span>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={12} />
              </button>
            </div>
            <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {message || 'The item was safely preserved in the dashboard KV store, but the Notion write was rejected.'}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(false);
                  onRetry();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--cr8w-primary, #C25B38)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={10} />
                <span>Retry Notion Sync</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 4. Skipped: Notion not configured for this item
  return (
    <span
      className={className}
      title={message || 'Saved in local operational store (Notion sync skipped)'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 6px',
        borderRadius: 10,
        background: 'var(--sandstone, rgba(168, 152, 136, 0.12))',
        color: 'var(--text-muted, #7A756E)',
        fontFamily: 'var(--font-label)',
        fontSize: '0.62rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        verticalAlign: 'middle',
      }}
    >
      <CloudOff size={10} />
      <span>local only</span>
    </span>
  );
}
