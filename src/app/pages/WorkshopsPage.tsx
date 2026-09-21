import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { FlowCommandCenter } from '../components/FlowCommandCenter';

export function WorkshopsPage() {
  const { data, actions } = useDashboard();

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
      <FlowCommandCenter />
    </ViewShell>
  );
}
