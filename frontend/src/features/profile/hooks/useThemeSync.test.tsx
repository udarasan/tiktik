import { act, screen, waitFor } from '@testing-library/react';
import { getMyProfile, updateMyProfile, type Profile } from '@/features/profile/api/profile';
import { useUiStore } from '@/stores/ui';
import { testProfile } from '@/test/fixtures';
import { renderRoute } from '@/test/render';

vi.mock('@/features/profile/api/profile');
vi.mock('@/features/auth/api/auth');

const saved: Profile = { ...testProfile, theme: 'dark' };

beforeEach(() => {
  vi.mocked(getMyProfile).mockReset().mockResolvedValue(saved);
  vi.mocked(updateMyProfile)
    .mockReset()
    .mockImplementation((_id, patch) => Promise.resolve({ ...saved, ...patch }));
});

describe('useThemeSync (FR-AUTH-09)', () => {
  it('applies the saved theme on sign-in without writing the local one back', async () => {
    useUiStore.setState({ theme: 'light' }); // this device had "light"
    renderRoute('/');
    await waitFor(() => {
      expect(useUiStore.getState().theme).toBe('dark');
    });
    expect(document.documentElement).toHaveClass('dark');
    // Regression: the old local value must not overwrite the saved theme.
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('saves later theme changes to the profile', async () => {
    useUiStore.setState({ theme: 'dark' });
    renderRoute('/');
    // Wait until the profile has loaded (the saved theme is applied first).
    await screen.findByRole('button', { name: 'Account menu for Alice Doe' });
    act(() => {
      useUiStore.getState().setTheme('system');
    });
    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith(saved.id, { theme: 'system' });
    });
  });
});
