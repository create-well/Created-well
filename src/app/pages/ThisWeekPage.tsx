import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { CanvaHomeView } from '../components/CanvaHomeView';
import { AddTaskModal } from '../components/AddTaskModal';

const VIEW_ROUTE_MAP: Record<string, string> = {
  hub: '/',
  geyser: '/moves',
  'community-events': '/flows',
  podyaps: '/podyaps',
  workshops: '/workshops',
  coflow: '/care',
  playground: '/',
};

export function ThisWeekPage() {
  const { data, actions, ui } = useDashboard();
  const navigate = useNavigate();
  const [showAddTask, setShowAddTask] = useState(false);

  const state = data.syncStatus === 'loading' ? 'loading' : data.syncStatus === 'failed' ? 'failed' : 'fresh';

  function handleNavigate(view: string) {
    if (view === 'geyser' || view === 'moves' || view === 'community-events') ui.setMovesDefaultTab('overview');
    navigate(VIEW_ROUTE_MAP[view] ?? '/');
  }

  const syncTime = data.lastSynced
    ? 'Synced ' + data.lastSynced.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <ViewShell state={state} emptyTitle="The Well is quiet" emptyBody="Nothing to surface this week. That's a clean slate." onRetry={actions.retrySync}>
      <CanvaHomeView
        onNavigate={handleNavigate}
        announcements={data.announcements}
        brainDumps={data.brainDumps}
        onAddBrainDump={actions.addBrainDump}
        syncTime={syncTime}
        activeUser={ui.chatActiveUser}
        wellNotes={data.wellNotes}
        onAddWellNote={actions.addWellNote}
        onLandWellNote={actions.landWellNote}
        workshops={data.workshops}
        coFlowDates={data.coFlowDates}
        coFlowCheckins={data.coFlowCheckins}
        actionItems={data.tasks}
        stations={data.stations}
      />
      {showAddTask && <AddTaskModal currentPerson={null} onAdd={actions.addTask} onClose={() => setShowAddTask(false)} />}
    </ViewShell>
  );
}
