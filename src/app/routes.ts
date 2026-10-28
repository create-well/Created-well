import { createBrowserRouter } from 'react-router';
import { RootLayout } from './RootLayout';
import { RouteSkeleton } from './components/RouteSkeleton';

// Route-level code splitting (Track FE, FE-4): each page is its own
// chunk, loaded on first navigation to it. The shell (RootLayout,
// TopNav, providers) stays in the entry chunk — the furniture never
// moves — and HydrateFallback renders the ViewShell loading skeleton
// while a chunk arrives, so panel order and frame are preserved.
const page = (load: () => Promise<Record<string, React.ComponentType>>, name: string) => ({
  HydrateFallback: RouteSkeleton,
  lazy: async () => ({ Component: (await load())[name] }),
});

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true,         ...page(() => import('./pages/ThisWeekPage'), 'ThisWeekPage') },
      { path: 'moves',       ...page(() => import('./pages/MovesPage'), 'MovesPage') },
      { path: 'care',        ...page(() => import('./pages/CarePage'), 'CarePage') },
      { path: 'flows',       ...page(() => import('./pages/FlowsPage'), 'FlowsPage') },
      { path: 'podyaps',     ...page(() => import('./pages/PodyapsPage'), 'PodyapsPage') },
      { path: 'workshops',   ...page(() => import('./pages/WorkshopsPage'), 'WorkshopsPage') },
      { path: 'money',       ...page(() => import('./pages/MoneyPage'), 'MoneyPage') },
      { path: 'decisions',   ...page(() => import('./pages/DecisionsPage'), 'DecisionsPage') },
      { path: 'system',      ...page(() => import('./pages/SystemPage'), 'SystemPage') },
      { path: 'source-first', ...page(() => import('./pages/SourceFirstPage'), 'SourceFirstPage') },
    ],
  },
]);
