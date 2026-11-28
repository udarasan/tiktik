import type { RouteObject } from 'react-router';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Route tree grows per milestone: auth (M2), /w/:slug (M3), /w/:slug/p/:key (M4+). Plan §7.11.
export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '*', element: <NotFoundPage /> },
];
