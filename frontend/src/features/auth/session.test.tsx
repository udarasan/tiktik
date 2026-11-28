import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { onAuthChange } from './api/auth';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './session';
import { fakeSession } from '@/test/render';

vi.mock('./api/auth');

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

function Status() {
  const auth = useAuth();
  return <p>{auth.status}</p>;
}

function setup() {
  let listener: Listener = () => undefined;
  vi.mocked(onAuthChange).mockImplementation((cb) => {
    listener = cb;
    return () => undefined;
  });
  const queryClient = new QueryClient();
  queryClient.setQueryData(['secret'], 'alice-data');
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Status />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return {
    emit: (e: AuthChangeEvent, s: Session | null) => {
      act(() => {
        listener(e, s);
      });
    },
    queryClient,
  };
}

describe('AuthProvider', () => {
  it('starts loading, then follows the initial session', () => {
    const { emit } = setup();
    expect(screen.getByText('loading')).toBeInTheDocument();
    emit('INITIAL_SESSION', fakeSession);
    expect(screen.getByText('signedIn')).toBeInTheDocument();
  });

  it('FR-AUTH-03 clears cached data on sign-out', () => {
    const { emit, queryClient } = setup();
    emit('INITIAL_SESSION', fakeSession);
    emit('SIGNED_OUT', null);
    expect(screen.getByText('signedOut')).toBeInTheDocument();
    expect(queryClient.getQueryData(['secret'])).toBeUndefined();
  });

  it('clears cached data when a different user signs in', () => {
    const { emit, queryClient } = setup();
    emit('INITIAL_SESSION', fakeSession);
    const bob = { ...fakeSession, user: { ...fakeSession.user, id: 'bob' } } as Session;
    emit('SIGNED_IN', bob);
    expect(queryClient.getQueryData(['secret'])).toBeUndefined();
  });

  it('keeps cached data on token refresh for the same user', () => {
    const { emit, queryClient } = setup();
    emit('INITIAL_SESSION', fakeSession);
    emit('TOKEN_REFRESHED', fakeSession);
    expect(queryClient.getQueryData(['secret'])).toBe('alice-data');
  });
});
