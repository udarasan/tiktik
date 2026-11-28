import type { RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { PublicOnlyRoute, RequireAuth } from '@/features/auth/components/RouteGuards';
import { CheckEmailPage } from '@/pages/auth/CheckEmailPage';
import { ConfirmEmailPage } from '@/pages/auth/ConfirmEmailPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MePage } from '@/pages/MePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Plan §7.11, §11.2–11.3. /w/:slug (M3) and /w/:slug/p/:key (M4+) arrive later.
export const routes: RouteObject[] = [
  // Public, only while signed out
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  // Public, any state (email links)
  { path: '/check-email', element: <CheckEmailPage /> },
  { path: '/auth/confirm', element: <ConfirmEmailPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  // Signed in
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          // Moves to /w/:slug/me in M3 (plan §11.3).
          { path: 'me', element: <MePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
