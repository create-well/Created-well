import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { HubView } from '../components/HubView';
import { AddTaskModal } from '../components/AddTaskModal';

const VIEW_ROUTE_MAP: Record<string, string> = {
  hub: '/',
  'community-events': '/gatherings',
  podyaps: '/making',
  workshops: '/gatherings?tab=workshops',
  team: '/people?tab=team',
  playground: '/',
};

export function ThisWeekPage() {
  const { data, actions, ui } = useDashboard();
  const navigate = useNavigate();
  const [showAddTask, setShowAddTask] = useState(false);

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' : 'fresh';

  function handleNavigate(view: string) {
    navigate(VIEW_ROUTE_MAP[view] ?? '/');
  }

  function handleNavigateStations() {
    navigate('/people?tab=team');
  }

  // Packet CC Map 2, door 5: a Geyser-class event's button opens its
  // own gathering record — never a class-level route.
  function handleOpenGeyserGathering(id: number) {
    navigate(`/gatherings/${id}`);
  }

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
        onNavigateStations={handleNavigateStations}
        onOpenGeyserGathering={handleOpenGeyserGathering}
        announcements={data.announcements}
        brainDumps={data.brainDumps}
        onAddBrainDump={actions.addBrainDump}
        onDeleteBrainDump={actions.deleteBrainDump}
        onUpdateBrainDump={actions.updateBrainDump}
                activeUser={ui.chatActiveUser}
        wellNotes={data.wellNotes}
        onAddWellNote={actions.addWellNote}
        onLandWellNote={actions.landWellNote}
        onDeleteWellNote={actions.deleteWellNote}
        coFlowDates={data.coFlowDates}
        coFlowCheckins={data.coFlowCheckins}
        actionItems={data.tasks}
        stations={data.stations}
        sourceErrors={data.sourceErrors}
      />
      {showAddTask && (
        <AddTaskModal
          currentPerson={null}
          onAdd={actions.addTask}
          onReconcile={actions.retrySync}
          onClose={() => setShowAddTask(false)}
        />
      )}
    </ViewShell>
  );
}
