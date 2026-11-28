import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resendConfirmation, signIn } from '@/features/auth/api/auth';
import { toAppError } from '@/lib/errors';
import { renderRoute, signedOut } from '@/test/render';
import { TEST_PASSWORD } from '@/test/fixtures';

vi.mock('@/features/auth/api/auth');

const authError = (code: string, status: number) =>
  toAppError({ __isAuthError: true, name: 'AuthApiError', code, status, message: 'x' });

async function fillAndSubmit(email = 'alice@example.com', password = TEST_PASSWORD) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

beforeEach(() => {
  vi.mocked(signIn).mockReset();
  vi.mocked(resendConfirmation).mockReset();
});

describe('LoginPage', () => {
  it('validates fields before calling Auth', async () => {
    renderRoute('/login', { auth: signedOut });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in and goes to ?next=', async () => {
    vi.mocked(signIn).mockResolvedValue();
    const { router } = renderRoute('/login?next=%2Fprojects', { auth: signedOut });
    await fillAndSubmit();
    expect(signIn).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: TEST_PASSWORD,
      captchaToken: undefined,
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects');
    });
  });

  it('FR-AUTH-02 shows one generic message for wrong credentials', async () => {
    vi.mocked(signIn).mockRejectedValue(authError('invalid_credentials', 400));
    renderRoute('/login', { auth: signedOut });
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('FR-AUTH-11 shows a rate-limit message on 429', async () => {
    vi.mocked(signIn).mockRejectedValue(authError('over_request_rate_limit', 429));
    renderRoute('/login', { auth: signedOut });
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });

  it('FR-AUTH-07 offers to resend the confirmation email for unconfirmed accounts', async () => {
    vi.mocked(signIn).mockRejectedValue(authError('email_not_confirmed', 400));
    vi.mocked(resendConfirmation).mockResolvedValue();
    renderRoute('/login', { auth: signedOut });
    const user = await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/confirm your email/i);
    await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }));
    expect(resendConfirmation).toHaveBeenCalledWith('alice@example.com');
  });
});
