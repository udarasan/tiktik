import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AuthContext, type AuthState } from '@/features/auth/context';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { routes as appRoutes } from '@/routes';

export const fakeSession = {
  access_token: 'test',
  refresh_token: 'test',
  expires_in: 1800,
  token_type: 'bearer',
  user: { id: '00000000-0000-0000-0000-00000000000a', email: 'alice@example.com' },
} as unknown as Session;

export const signedIn: AuthState = { status: 'signedIn', session: fakeSession };
export const signedOut: AuthState = { status: 'signedOut' };

function ThemeEffect() {
  useThemeEffect();
  return null;
}

/** Renders the app's routes at `path` with a fixed auth state (no Supabase calls). */
export function renderRoute(
  path: string,
  { auth = signedIn, routes = appRoutes }: { auth?: AuthState; routes?: RouteObject[] } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <ThemeEffect />
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
