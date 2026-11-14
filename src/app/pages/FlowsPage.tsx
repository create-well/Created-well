import React from 'react';
import { useSearchParams } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CommunityEventsView } from '../components/CommunityEventsView';

export function FlowsPage() {
  const { data, actions } = useDashboard();
  const [searchParams] = useSearchParams();

  // Spec D tab contract: ?tab=workshops is the one addressable tab
  // key; a missing or unknown value falls back to the default
  // (upcoming). The value is read on every render, and
  // CommunityEventsView watches its tab input, so an in-app change
  // of the parameter retargets the visible tab while mounted.
  const tabParam = searchParams.get('tab');

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
        <CommunityEventsView defaultTab={tabParam === 'workshops' ? 'workshops' : undefined} />
      </div>
    </ViewShell>
  );
}
