import React from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { WorkshopsView } from '../components/WorkshopsView';

export function FlowsPage() {
  const { data, actions } = useDashboard();

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' :
    (data.workshops.length === 0 && data.workshopPrograms.length === 0) ? 'empty' : 'fresh';

  return (
    <ViewShell
      state={state}
      emptyTitle="No FLOWS yet"
      emptyBody="Workshops, programs, and resources will live here. Start by scheduling the first one."
      onRetry={actions.retrySync}
    >
      <WorkshopsView
        workshops={data.workshops}
        programs={data.workshopPrograms}
        resources={data.workshopResources}
        onAddWorkshop={actions.addWorkshop}
        onUpdateWorkshop={actions.updateWorkshop}
        onDeleteWorkshop={actions.deleteWorkshop}
        onAddProgram={actions.addWorkshopProgram}
        onUpdateProgram={actions.updateWorkshopProgram}
        onDeleteProgram={actions.deleteWorkshopProgram}
        onAddResource={actions.addWorkshopResource}
        onDeleteResource={actions.deleteWorkshopResource}
      />
    </ViewShell>
  );
}
