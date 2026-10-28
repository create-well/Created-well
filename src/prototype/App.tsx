import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Selection, SelectionContext, SOURCE_HOME } from './lib/selection';
import { RowDetail } from './components/RowDetail';
import HomeView from './views/HomeView';
import TasksView from './views/TasksView';
import PeopleView from './views/PeopleView';
import ContentView from './views/ContentView';
import MoneyView from './views/MoneyView';
import IntakeView from './views/IntakeView';
import SyncHealthView from './views/SyncHealthView';

/* Home is the rim. MOVES presents as Tasks. Flows has no top-level view:
   it is subordinate, surfacing as the starting-soon feed on Home. */
const TABS: { route: string; label: string }[] = [
  { route: 'home', label: 'Home' },
  { route: 'tasks', label: 'Tasks' },
  { route: 'people', label: 'People' },
  { route: 'content', label: 'Content' },
  { route: 'money', label: 'Money' },
  { route: 'intake', label: 'Intake' },
  { route: 'sync', label: 'Sync Health' },
];

function routeFromHash(): string {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return TABS.some((t) => t.route === raw) ? raw : 'home';
}

export default function App() {
  const [route, setRoute] = useState<string>(() => routeFromHash());
  const [selected, setSelected] = useState<Selection | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const jumpTo = useCallback((source: string, id: string) => {
    setSelected({ source, id });
    const home = SOURCE_HOME[source] || 'home';
    if (routeFromHash() !== home) {
      window.location.hash = `#/${home}`;
    }
  }, []);

  const clear = useCallback(() => setSelected(null), []);

  const selectionApi = useMemo(
    () => ({ selected, jumpTo, clear }),
    [selected, jumpTo, clear],
  );

  return (
    <SelectionContext.Provider value={selectionApi}>
      <div className="app">
        <header className="app-header">
          <h1 className="wordmark">Create Well — Source-First Hub</h1>
          <p className="stamp">
            Read-only views over the Notion source, drawn up through sync. Nothing here
            writes back. When the water was drawn is stated once per screen.
          </p>
          <nav className="tab-nav" aria-label="Views">
            {TABS.map((t) => (
              <a
                key={t.route}
                href={`#/${t.route}`}
                className={`tab-button${route === t.route ? ' tab-active' : ''}`}
                aria-current={route === t.route ? 'page' : undefined}
              >
                {t.label}
              </a>
            ))}
          </nav>
        </header>

        <main className="app-main">
          {route === 'home' && <HomeView />}
          {route === 'tasks' && <TasksView />}
          {route === 'people' && <PeopleView />}
          {route === 'content' && <ContentView />}
          {route === 'money' && <MoneyView />}
          {route === 'intake' && <IntakeView />}
          {route === 'sync' && <SyncHealthView />}
        </main>

        <RowDetail />
      </div>
    </SelectionContext.Provider>
  );
}
