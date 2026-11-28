import { screen, waitFor } from '@testing-library/react';
import { verifyEmailLink } from '@/features/auth/api/auth';
import { toAppError } from '@/lib/errors';
import { renderRoute, signedIn, signedOut } from '@/test/render';

vi.mock('@/features/auth/api/auth');

beforeEach(() => {
  vi.mocked(verifyEmailLink).mockReset();
});

describe('ConfirmEmailPage (FR-AUTH-07)', () => {
  it('verifies the token hash from the email link', async () => {
    vi.mocked(verifyEmailLink).mockResolvedValue();
    renderRoute('/auth/confirm?token_hash=abc&type=email', { auth: signedOut });
    await waitFor(() => {
      expect(verifyEmailLink).toHaveBeenCalledWith('abc', 'email');
    });
  });

  it('shows an expired-link message when verification fails', async () => {
    vi.mocked(verifyEmailLink).mockRejectedValue(
      toAppError({ __isAuthError: true, code: 'otp_expired', status: 403 }),
    );
    renderRoute('/auth/confirm?token_hash=old&type=email', { auth: signedOut });
    expect(
      await screen.findByRole('heading', { name: 'Link expired or invalid' }),
    ).toBeInTheDocument();
  });

  it('goes to the dashboard once signed in', async () => {
    const { router } = renderRoute('/auth/confirm?code=xyz', { auth: signedIn });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });
});

describe('ResetPasswordPage (FR-AUTH-06)', () => {
  it('verifies the recovery link', async () => {
    vi.mocked(verifyEmailLink).mockResolvedValue();
    renderRoute('/reset-password?token_hash=r1&type=recovery', { auth: signedOut });
    await waitFor(() => {
      expect(verifyEmailLink).toHaveBeenCalledWith('r1', 'recovery');
    });
  });

  it('shows the new-password form in a recovery session', () => {
    renderRoute('/reset-password', { auth: signedIn });
    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
  });

  it('does not show the form for a used link, even when already signed in', async () => {
    vi.mocked(verifyEmailLink).mockRejectedValue(
      toAppError({ __isAuthError: true, code: 'otp_expired', status: 403 }),
    );
    renderRoute('/reset-password?token_hash=used&type=recovery', { auth: signedIn });
    expect(screen.getByRole('heading', { name: 'Checking your link…' })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Link expired or invalid' }),
    ).toBeInTheDocument();
  });

  it('shows the form once the link is verified', async () => {
    vi.mocked(verifyEmailLink).mockResolvedValue();
    renderRoute('/reset-password?token_hash=ok&type=recovery', { auth: signedIn });
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
  });

  it('rejects a visit without a link or session', () => {
    renderRoute('/reset-password', { auth: signedOut });
    expect(screen.getByRole('heading', { name: 'Link expired or invalid' })).toBeInTheDocument();
  });
});
