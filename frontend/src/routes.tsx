import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Route tree grows per milestone: public auth pages outside the shell (M2),
// /w/:slug (M3), /w/:slug/p/:key/{list,board} (M4+). Plan §7.11, §11.2.
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
