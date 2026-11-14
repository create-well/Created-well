import { createElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
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

// Restructure Phase 0 (spec D): the old section paths redirect to the
// seven names, with replace so the back button never lands on a dead
// name. Redirects stay until Monny says drop them. This file is .ts
// (no JSX), so the specced Navigate element is built with
// createElement — Navigate from react-router is the route import.
const redirect = (to: string) => ({
  element: createElement(Navigate, { to, replace: true }),
});

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true,         ...page(() => import('./pages/ThisWeekPage'), 'ThisWeekPage') },
      { path: 'gatherings', ...page(() => import('./pages/FlowsPage'), 'FlowsPage') },
      { path: 'making',     ...page(() => import('./pages/PodyapsPage'), 'PodyapsPage') },
      { path: 'people',     ...page(() => import('./pages/CarePage'), 'CarePage') },
      { path: 'money',      ...page(() => import('./pages/MoneyPage'), 'MoneyPage') },
      { path: 'decisions',  ...page(() => import('./pages/DecisionsPage'), 'DecisionsPage') },
      { path: 'system',     ...page(() => import('./pages/SystemPage'), 'SystemPage') },
      { path: 'flows',      ...redirect('/gatherings') },
      { path: 'workshops',  ...redirect('/gatherings?tab=workshops') },
      { path: 'podyaps',    ...redirect('/making') },
      { path: 'moves',      ...redirect('/#waiting') },
      { path: 'care',       ...redirect('/people') },
    ],
  },
]);
