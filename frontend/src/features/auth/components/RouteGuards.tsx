import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { safeNextPath } from '../redirect';
import { useAuth } from '../hooks/useAuth';

function FullPageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex h-dvh items-center justify-center">
      <span className="text-muted-foreground">Loading…</span>
    </div>
  );
}

/** Protected routes: signed-out users go to /login?next=<where they were>. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <FullPageLoading />;
  if (auth.status === 'signedOut') {
    const next = `${location.pathname}${location.search}`;
    const to = next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}

/** Login / register / forgot password: signed-in users go straight to ?next= or home. */
export function PublicOnlyRoute() {
  const auth = useAuth();
  const [params] = useSearchParams();

  if (auth.status === 'loading') return <FullPageLoading />;
  if (auth.status === 'signedIn') return <Navigate to={safeNextPath(params.get('next'))} replace />;
  return <Outlet />;
}
