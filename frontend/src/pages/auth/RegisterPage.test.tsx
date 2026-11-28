import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signUp } from '@/features/auth/api/auth';
import { toAppError } from '@/lib/errors';
import { renderRoute, signedOut } from '@/test/render';
import { NO_DIGIT_PASSWORD, TEST_PASSWORD } from '@/test/fixtures';

vi.mock('@/features/auth/api/auth');

beforeEach(() => {
  vi.mocked(signUp).mockReset();
});

async function fill(password = TEST_PASSWORD) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Full name'), 'Alice Doe');
  await user.type(screen.getByLabelText('Email'), 'alice@example.com');
  await user.type(screen.getByLabelText('Password'), password);
  return user;
}

describe('RegisterPage (FR-AUTH-01)', () => {
  it('shows live password rules', async () => {
    renderRoute('/register', { auth: signedOut });
    await fill('abc');
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(rules).toHaveTextContent('At least one letter (met)');
    expect(rules).toHaveTextContent('At least one number (not met)');
  });

  it('blocks a weak password without calling Auth', async () => {
    renderRoute('/register', { auth: signedOut });
    const user = await fill(NO_DIGIT_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Include at least one number')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('signs up and shows the check-your-email page', async () => {
    vi.mocked(signUp).mockResolvedValue();
    const { router } = renderRoute('/register', { auth: signedOut });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(signUp).toHaveBeenCalledWith({
      fullName: 'Alice Doe',
      email: 'alice@example.com',
      password: TEST_PASSWORD,
      captchaToken: undefined,
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/check-email');
    });
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('maps a server-side weak_password to the password field', async () => {
    vi.mocked(signUp).mockRejectedValue(
      toAppError({ __isAuthError: true, code: 'weak_password', status: 422, message: 'x' }),
    );
    renderRoute('/register', { auth: signedOut });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Choose a stronger password.')).toBeInTheDocument();
  });
});
