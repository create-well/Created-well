import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { GeyserView } from '../components/GeyserView';
import { AddTaskModal } from '../components/AddTaskModal';

const VIEW_ROUTE_MAP: Record<string, string> = {
  hub: '/',
  geyser: '/moves',
  workshops: '/flows',
  coflow: '/care',
};

export function MovesPage() {
  const { data, actions, ui } = useDashboard();
  const navigate = useNavigate();
  const [showAddTask, setShowAddTask] = useState(false);

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' : 'fresh';

  const forumNotesForView = data.forum.map(f => ({
    id: f.id, author: f.author, content: f.content, created_at: f.created_at,
  }));

  function handleNavigate(view: string) {
    navigate(VIEW_ROUTE_MAP[view] ?? '/');
  }

  return (
    <ViewShell
      state={state}
      emptyTitle="No active moves"
      emptyBody="Tasks and stations will surface here. A clear board is a healthy board."
      onRetry={actions.retrySync}
    >
      <GeyserView
        onNavigate={handleNavigate}
        actionItems={data.tasks}
        stations={data.stations}
        announcements={data.announcements}
        wellNotes={forumNotesForView}
        forum={data.forum}
        forumReplies={data.forumReplies}
        defaultTab={ui.movesDefaultTab}
        onAddTask={() => setShowAddTask(true)}
        onUpdateTaskStatus={actions.updateTaskStatus}
        onUpdateTask={actions.updateTask}
        onDeleteTask={actions.deleteTask}
        onDismissAnnouncement={actions.dismissAnnouncement}
        onAddAnnouncement={actions.addAnnouncement}
        onAddNote={(content, author) => actions.addForumPost({ author, content })}
        onAddForumPost={actions.addForumPost}
        onUpdateForumPost={actions.updateForumPost}
        onDeleteForumPost={actions.deleteForumPost}
        onAddForumReply={actions.addForumReply}
        onDeleteForumReply={actions.deleteForumReply}
        onUpdateStationStatus={actions.updateStationStatus}
        onUpdateStationOwner={actions.updateStationOwner}
        onUpdateStationField={actions.updateStationField}
        onAddStation={actions.addStation}
        onDeleteStation={actions.deleteStation}
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
