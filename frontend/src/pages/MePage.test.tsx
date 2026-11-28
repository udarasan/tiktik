import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { changePassword } from '@/features/auth/api/auth';
import { getMyProfile, updateMyProfile, type Profile } from '@/features/profile/api/profile';
import { toAppError } from '@/lib/errors';
import { useUiStore } from '@/stores/ui';
import { OTHER_TEST_PASSWORD, TEST_PASSWORD, testProfile } from '@/test/fixtures';
import { renderRoute } from '@/test/render';

vi.mock('@/features/profile/api/profile');
vi.mock('@/features/auth/api/auth');

const profile: Profile = testProfile;

beforeEach(() => {
  vi.mocked(getMyProfile).mockReset().mockResolvedValue(profile);
  vi.mocked(updateMyProfile)
    .mockReset()
    .mockImplementation((_id, patch) => Promise.resolve({ ...profile, ...patch }));
  vi.mocked(changePassword).mockReset();
  useUiStore.setState({ theme: 'dark' });
});

const profileCard = async () =>
  within(
    (await screen.findByRole('heading', { name: 'Profile', level: 2 })).closest(
      '[data-slot="card"]',
    ) as HTMLElement,
  );
const passwordCard = () =>
  within(
    screen
      .getByRole('heading', { name: 'Password', level: 2 })
      .closest('[data-slot="card"]') as HTMLElement,
  );

describe('MePage — profile (FR-AUTH-08/09)', () => {
  it('loads the saved profile', async () => {
    renderRoute('/me');
    const card = await profileCard();
    expect(await card.findByLabelText('Full name')).toHaveValue('Alice Doe');
    expect(card.getByLabelText('Time zone')).toHaveValue('UTC');
    expect(getMyProfile).toHaveBeenCalledWith('00000000-0000-0000-0000-00000000000a');
  });

  it('saves name, job title and time zone (theme goes through the theme store)', async () => {
    const user = userEvent.setup();
    renderRoute('/me');
    const card = await profileCard();
    const name = await card.findByLabelText('Full name');
    await user.clear(name);
    await user.type(name, 'Alice D.');
    await user.type(card.getByLabelText('Job title'), 'Designer');
    await user.selectOptions(card.getByLabelText('Time zone'), 'Asia/Colombo');
    await user.selectOptions(card.getByLabelText('Theme'), 'light');
    await user.click(card.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => {
      expect(updateMyProfile).toHaveBeenCalledWith('00000000-0000-0000-0000-00000000000a', {
        full_name: 'Alice D.',
        job_title: 'Designer',
        time_zone: 'Asia/Colombo',
      });
    });
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('validates the name before saving', async () => {
    const user = userEvent.setup();
    renderRoute('/me');
    const card = await profileCard();
    await user.clear(await card.findByLabelText('Full name'));
    await user.click(card.getByRole('button', { name: 'Save profile' }));
    expect(await card.findByText('Enter your name')).toBeInTheDocument();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('disables Save until something changes', async () => {
    renderRoute('/me');
    const card = await profileCard();
    await card.findByLabelText('Full name');
    expect(card.getByRole('button', { name: 'Save profile' })).toBeDisabled();
  });
});

describe('MePage — change password (FR-AUTH-05)', () => {
  async function fill(current: string, next: string, confirm = next) {
    const user = userEvent.setup();
    renderRoute('/me');
    await screen.findByRole('heading', { name: 'Password', level: 2 });
    const card = passwordCard();
    await user.type(card.getByLabelText('Current password'), current);
    await user.type(card.getByLabelText('New password', { exact: true }), next);
    await user.type(card.getByLabelText('Confirm new password'), confirm);
    await user.click(card.getByRole('button', { name: 'Change password' }));
    return card;
  }

  it('requires the current password and a matching confirmation', async () => {
    const user = userEvent.setup();
    renderRoute('/me');
    await screen.findByRole('heading', { name: 'Password', level: 2 });
    await user.click(passwordCard().getByRole('button', { name: 'Change password' }));
    expect(await passwordCard().findByText('Enter your current password')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('changes the password', async () => {
    vi.mocked(changePassword).mockResolvedValue();
    const card = await fill(TEST_PASSWORD, OTHER_TEST_PASSWORD);
    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: TEST_PASSWORD,
        newPassword: OTHER_TEST_PASSWORD,
      });
    });
    await waitFor(() => {
      expect(card.getByLabelText('Current password')).toHaveValue('');
    });
  });

  it('shows a field error when the current password is wrong', async () => {
    vi.mocked(changePassword).mockRejectedValue(
      toAppError({ __isAuthError: true, code: 'current_password_invalid', status: 400 }),
    );
    const card = await fill(TEST_PASSWORD, OTHER_TEST_PASSWORD);
    expect(await card.findByText('Current password is incorrect.')).toBeInTheDocument();
  });

  it('rejects reusing the current password before calling Auth', async () => {
    const card = await fill(TEST_PASSWORD, TEST_PASSWORD);
    expect(await card.findByText(/different password/)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });
});
