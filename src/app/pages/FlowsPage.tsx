import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CommunityEventsView } from '../components/CommunityEventsView';

export function FlowsPage() {
  const { data, actions } = useDashboard();

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' :
    'fresh';

  return (
    <ViewShell
      state={state}
      emptyTitle="No community events yet"
      emptyBody="Podyaps, Book Club sessions, and Workshops from FLOWS will appear here once scheduled in Notion."
      onRetry={actions.retrySync}
    >
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <CommunityEventsView />
      </div>
    </ViewShell>
  );
}
