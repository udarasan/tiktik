import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthChange } from './api/auth';
import { AuthContext, type AuthState } from './context';

/**
 * Tracks the Supabase session (FR-AUTH-04: supabase-js refreshes it automatically).
 * Clears the TanStack Query cache when the user signs out or a different user signs in,
 * so no data from one account is shown to another.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const userIdRef = useRef<string | null>(null);

  useEffect(
    () =>
      onAuthChange((event, session) => {
        // Keep this callback synchronous: supabase-js must not be awaited inside it.
        const nextUserId = session?.user.id ?? null;
        if (event === 'SIGNED_OUT' || (userIdRef.current && userIdRef.current !== nextUserId)) {
          queryClient.clear();
        }
        userIdRef.current = nextUserId;
        setState(session ? { status: 'signedIn', session } : { status: 'signedOut' });
      }),
    [queryClient],
  );

  return <AuthContext value={state}>{children}</AuthContext>;
}
