import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { requestPasswordReset } from '@/features/auth/api/auth';
import { toAppError } from '@/lib/errors';
import { renderRoute, signedOut } from '@/test/render';

vi.mock('@/features/auth/api/auth');

async function submit() {
  renderRoute('/forgot-password', { auth: signedOut });
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'who@example.com');
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
}

describe('ForgotPasswordPage (FR-AUTH-06)', () => {
  it('confirms without revealing whether the account exists', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue();
    await submit();
    expect(await screen.findByText(/If an account exists for/)).toBeInTheDocument();
  });

  it('shows the same confirmation when Auth returns another error', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(toAppError({ status: 400 }));
    await submit();
    expect(await screen.findByText(/If an account exists for/)).toBeInTheDocument();
  });

  it('only surfaces rate limiting', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(toAppError({ status: 429 }));
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
  });
});
