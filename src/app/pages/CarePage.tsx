import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CoFlowD8sView } from '../components/CoFlowD8sView';

export function CarePage() {
  const { data, actions } = useDashboard();

  const state =
    !data.permissions.careConsent ? 'restricted' :
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' :
    (data.coFlowDates.length === 0 && data.coFlowCheckins.length === 0) ? 'empty' : 'fresh';

  return (
    <ViewShell
      state={state}
      emptyTitle="No care loop scheduled"
      emptyBody="The next right invitation will appear here when it's time. Nothing to act on right now."
      restrictedTitle="Care Loop — consent required"
      restrictedBody="Contact CTAs and scheduling are suppressed until consent is confirmed. Reach out directly to update your settings."
      onRetry={actions.retrySync}
    >
      <CoFlowD8sView
        coflowDates={data.coFlowDates}
        coflowCheckins={data.coFlowCheckins}
        onAddCoFlowDate={actions.addCoFlowDate}
        onUpdateCoFlowDate={actions.updateCoFlowDate}
        onDeleteCoFlowDate={actions.deleteCoFlowDate}
        onAddCoFlowCheckin={actions.addCoFlowCheckin}
        onDeleteCoFlowCheckin={actions.deleteCoFlowCheckin}
      />
    </ViewShell>
  );
}
