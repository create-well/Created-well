import { createBrowserRouter } from 'react-router';
import { RootLayout } from './RootLayout';
import { ThisWeekPage } from './pages/ThisWeekPage';
import { MovesPage } from './pages/MovesPage';
import { CarePage } from './pages/CarePage';
import { FlowsPage } from './pages/FlowsPage';
import { MoneyPage } from './pages/MoneyPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { SystemPage } from './pages/SystemPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true,         Component: ThisWeekPage },
      { path: 'moves',       Component: MovesPage },
      { path: 'care',        Component: CarePage },
      { path: 'flows',       Component: FlowsPage },
      { path: 'money',       Component: MoneyPage },
      { path: 'decisions',   Component: DecisionsPage },
      { path: 'system',      Component: SystemPage },
    ],
  },
]);
