import React from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CommunityEventsView } from '../components/CommunityEventsView';

export function WorkshopsPage() {
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
      emptyTitle="No workshops yet"
      emptyBody="Workshops, Wellshops, Expresshops, and Playshops will appear here once added in Notion."
      onRetry={actions.retrySync}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div style={{ marginBottom: 16 }}>
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
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--cr8w-text, #2D2438)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Workshops &amp; Gatherings 🎨
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Wellshops · Expresshops · Playshops · Book Club
          </p>
        </div>

        <CommunityEventsView defaultTab="workshops" />
      </div>
    </ViewShell>
  );
}
