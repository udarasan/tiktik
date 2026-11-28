import { screen } from '@testing-library/react';
import { renderRoute, signedIn, signedOut } from '@/test/render';

vi.mock('@/features/auth/api/auth');

describe('route guards', () => {
  it('sends signed-out users from / to /login', () => {
    const { router } = renderRoute('/', { auth: signedOut });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('remembers where a signed-out user was going', () => {
    const { router } = renderRoute('/somewhere?task=WEB-1', { auth: signedOut });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      `?next=${encodeURIComponent('/somewhere?task=WEB-1')}`,
    );
  });

  it('shows a loading state while the session is being restored', () => {
    renderRoute('/', { auth: { status: 'loading' } });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('sends signed-in users away from /login to ?next=', () => {
    const { router } = renderRoute('/login?next=%2Fother', { auth: signedIn });
    expect(router.state.location.pathname).toBe('/other');
  });

  it('ignores an unsafe ?next= for signed-in users', () => {
    const { router } = renderRoute('/login?next=%2F%2Fevil.example.com', { auth: signedIn });
    expect(router.state.location.pathname).toBe('/');
  });
});
