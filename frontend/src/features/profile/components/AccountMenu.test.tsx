import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signOut } from '@/features/auth/api/auth';
import { getMyProfile } from '@/features/profile/api/profile';
import { testProfile } from '@/test/fixtures';
import { renderRoute } from '@/test/render';

vi.mock('@/features/profile/api/profile');
vi.mock('@/features/auth/api/auth');

beforeEach(() => {
  vi.mocked(getMyProfile).mockResolvedValue(testProfile);
  vi.mocked(signOut).mockReset().mockResolvedValue();
});

describe('AccountMenu (FR-AUTH-03, FR-AUTH-08)', () => {
  it('shows initials and links to profile & settings', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/');
    const trigger = await screen.findByRole('button', { name: 'Account menu for Alice Doe' });
    expect(trigger).toHaveTextContent('AD');
    await user.click(trigger);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Profile & settings' }));
    expect(router.state.location.pathname).toBe('/me');
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Account menu for Alice Doe' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });
});
