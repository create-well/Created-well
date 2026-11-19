import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useDashboard } from '../contexts/DashboardContext';
import { TopNav } from './components/TopNav';
import { SyncStatusBar } from './components/SyncStatusBar';
import { MessageDrawer } from './components/MessageDrawer';
import { WelcomeModal } from './components/WelcomeModal';
import { DecomprocessFAB } from './components/DecomprocessFAB';
import { ToastContainer } from './components/Toast';
import { AddTaskModal } from './components/AddTaskModal';
import './cr8w.css';

export function RootLayout() {
  const { data, actions, ui } = useDashboard();
  const location = useLocation();
  const navigate = useNavigate();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  // Scroll to top on route change. A hash-carrying arrival has its
  // own scroll owner (the anchor's settle-scroll, e.g. /#waiting);
  // this smooth animation otherwise outlives the anchor's instant
  // scroll and drags the page back to 0 (Phase 1, QA trace).
  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Contract C1 (equivalent orientation): announce the destination view
  // on route change for assistive tech; the initial load stays silent.
  const VIEW_NAMES: Record<string, string> = {
    '/': 'Today',
    '/gatherings': 'Gatherings',
    '/making': 'Making',
    '/people': 'People',
    '/money': 'Money',
    '/decisions': 'Decisions',
    '/system': 'System',
  };
  const [announcedView, setAnnouncedView] = useState('');
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    setAnnouncedView(VIEW_NAMES[location.pathname] ?? '');
  }, [location.pathname]);

  // Scroll-to-top button visibility
  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="cr8w-app" style={{ paddingBottom: '20px' }}>
      <div className="visually-hidden" aria-live="polite" role="status">
        {announcedView ? `${announcedView} view` : ''}
      </div>
      <TopNav onSignOut={actions.signOut} />
      <SyncStatusBar />

      <main className="cr-main">
        <Outlet />
      </main>

      {showAddTask && (
        <AddTaskModal
          currentPerson={ui.activePerson}
          onAdd={actions.addTask}
          onReconcile={actions.retrySync}
          onClose={() => setShowAddTask(false)}
        />
      )}

      <MessageDrawer
        messages={data.messages}
        onSend={actions.sendMessage}
        onDelete={actions.deleteMessage}
        onUpdate={actions.updateMessage}
        onUpdateFields={actions.updateMessageFields}
        onNavigateToForum={() => { navigate('/#waiting'); }}
        onNavigateToGeyser={() => { navigate('/#waiting'); }}
        onNavigateToStations={() => { ui.setMovesDefaultTab('stations'); navigate('/#waiting'); }}
        onNavigateToPeople={(tab) => { navigate(tab === 'vetting' ? '/people?tab=vetting' : '/people?tab=team'); }}
        activeAs={ui.chatActiveUser}
        onSetActiveAs={ui.setChatActiveUser}
        onAddWellNote={actions.addWellNote}
      />

      <button
        className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Back to top"
        style={{ bottom: 'calc(116px + max(0px, env(safe-area-inset-bottom, 0px) - 20px))', left: '20px', right: 'auto' }}
      >
        ↑
      </button>

      {ui.showWelcome && (
        <WelcomeModal
          activeUser={ui.chatActiveUser}
          onDismiss={() => ui.setShowWelcome(false)}
        />
      )}

      <DecomprocessFAB />
      <ToastContainer />
    </div>
  );
}
