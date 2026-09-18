import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useDashboard } from '../contexts/DashboardContext';
import { TopNav } from './components/TopNav';
import { SyncStatusBar } from './components/SyncStatusBar';
import { MessageDrawer } from './components/MessageDrawer';
import { WelcomeModal } from './components/WelcomeModal';
import { DecomprocessFAB } from './components/DecomprocessFAB';
import { ToastContainer } from './components/Toast';
import { PersonView } from './components/PersonView';
import { AddTaskModal } from './components/AddTaskModal';
import './cr8w.css';

export function RootLayout() {
  const { data, actions, ui } = useDashboard();
  const location = useLocation();
  const navigate = useNavigate();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showDomainBanner, setShowDomainBanner] = useState(() => {
    const isCustomDomain = window.location.hostname === 'createwell.monnyfest.co';
    const dismissed = sessionStorage.getItem('cr8w_domain_banner_dismissed');
    return !isCustomDomain && !dismissed;
  });
  const [showAddTask, setShowAddTask] = useState(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Scroll-to-top button visibility
  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="cr8w-app" style={{ paddingBottom: '20px' }}>
      <TopNav onSignOut={actions.signOut} />
      <SyncStatusBar />

      {showDomainBanner && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(123,168,157,0.12) 0%, rgba(184,169,212,0.08) 100%)',
          border: '1px solid rgba(123,168,157,0.2)',
          color: 'var(--text-primary, #EAE3DB)',
          textAlign: 'center',
          fontSize: '0.78rem',
          padding: '8px 40px 8px 12px',
          fontFamily: 'var(--font-label, Montserrat, sans-serif)',
          letterSpacing: '0.01em',
          lineHeight: 1.5,
          position: 'relative',
        }}>
          🔧 Custom domain is setting up — you're viewing via the direct link. Bookmark this page!
          <button
            onClick={() => {
              setShowDomainBanner(false);
              sessionStorage.setItem('cr8w_domain_banner_dismissed', 'true');
            }}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted, #8A7D72)',
              cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '2px 4px',
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <main className="cr-main">
        <Outlet />
      </main>

      {/* Persistent person view overlay — not a route */}
      {ui.activePerson && (
        <>
          <div
            onClick={() => ui.setActivePerson(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(45,36,56,0.4)',
              zIndex: 200, backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 'min(480px, 100vw)',
            background: 'var(--cr8w-bg, #EAE3DB)',
            zIndex: 201,
            overflowY: 'auto',
            boxShadow: '-8px 0 32px rgba(45,36,56,0.18)',
          }}>
            <button
              onClick={() => ui.setActivePerson(null)}
              style={{
                position: 'sticky', top: 12, left: '100%', marginLeft: -44,
                zIndex: 1, width: 32, height: 32, borderRadius: '50%',
                background: 'var(--cr8w-card-bg)', border: '1px solid var(--border-soft)',
                cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Close"
            >
              ×
            </button>
            <PersonView
              key={ui.activePerson}
              person={ui.activePerson}
              onNavigate={() => ui.setActivePerson(null)}
              actionItems={data.tasks}
              momentumItems={[]}
              wellNotes={data.forum.map(f => ({ id: f.id, author: f.author, content: f.content, created_at: f.created_at }))}
              stations={data.stations}
              onAddTask={() => setShowAddTask(true)}
              onUpdateTaskStatus={actions.updateTaskStatus}
              onAddMomentum={() => {}}
              onAddNote={(content: string, author: string) => actions.addForumPost({ author, content })}
            />
          </div>
        </>
      )}

      {showAddTask && (
        <AddTaskModal
          currentPerson={ui.activePerson}
          onAdd={actions.addTask}
          onClose={() => setShowAddTask(false)}
        />
      )}

      <MessageDrawer
        messages={data.messages}
        onSend={actions.sendMessage}
        onDelete={actions.deleteMessage}
        onUpdate={actions.updateMessage}
        onUpdateFields={actions.updateMessageFields}
        onNavigateToForum={() => { navigate('/moves'); }}
        onNavigateToGeyser={() => { navigate('/moves'); }}
        onNavigateToStations={() => { ui.setMovesDefaultTab('stations'); navigate('/moves'); }}
        onNavigateToPlayD8s={() => { navigate('/care'); }}
        activeAs={ui.chatActiveUser}
        onSetActiveAs={ui.setChatActiveUser}
        onAddWellNote={actions.addWellNote}
      />

      <button
        className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Back to top"
        style={{ bottom: '84px', left: '20px', right: 'auto' }}
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
