import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { HubView } from '../components/HubView';
import { AddTaskModal } from '../components/AddTaskModal';

const VIEW_ROUTE_MAP: Record<string, string> = {
  hub: '/',
  geyser: '/moves',
  workshops: '/flows',
  coflow: '/care',
  playground: '/',
};

export function ThisWeekPage() {
  const { data, actions, ui } = useDashboard();
  const navigate = useNavigate();
  const [showAddTask, setShowAddTask] = useState(false);

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' : 'fresh';

  function handleNavigate(view: string) {
    if (view === 'geyser' || view === 'moves') {
      ui.setMovesDefaultTab('overview');
    }
    navigate(VIEW_ROUTE_MAP[view] ?? '/');
  }

  function handleNavigateGeyserStations() {
    ui.setMovesDefaultTab('stations');
    navigate('/moves');
  }

  const syncTime = data.lastSynced
    ? 'Synced ' + data.lastSynced.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  const forumNotesForView = data.forum.map(f => ({
    id: f.id, author: f.author, content: f.content, created_at: f.created_at,
  }));

  return (
    <ViewShell
      state={state}
      emptyTitle="The Well is quiet"
      emptyBody="Nothing to surface this week. That's a clean slate."
      onRetry={actions.retrySync}
    >
      <HubView
        onNavigate={handleNavigate}
        onNavigateGeyserStations={handleNavigateGeyserStations}
        announcements={data.announcements}
        brainDumps={data.brainDumps}
        onAddBrainDump={actions.addBrainDump}
        onDeleteBrainDump={actions.deleteBrainDump}
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
      {showAddTask && (
        <AddTaskModal
          currentPerson={null}
          onAdd={actions.addTask}
          onClose={() => setShowAddTask(false)}
        />
      )}
    </ViewShell>
  );
}
