import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { resendConfirmation } from '@/features/auth/api/auth';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { toAppError } from '@/lib/errors';

/** Shown after sign-up (FR-AUTH-07). */
export function CheckEmailPage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    try {
      await resendConfirmation(email);
      toast.success('Confirmation email sent again.');
    } catch (e) {
      const err = toAppError(e);
      toast.error(
        err.code === 'RATE_LIMITED' ? 'Please wait a minute before resending.' : err.message,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout
      title="Check your email"
      footer={
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <MailCheck aria-hidden className="size-10 text-muted-foreground" />
        <p>
          We sent a confirmation link to {email ? <strong>{email}</strong> : 'your email address'}.
          Open it to activate your account, then sign in.
        </p>
        {email ? (
          <Button variant="outline" onClick={() => void resend()} disabled={sending}>
            {sending ? 'Sending…' : 'Resend email'}
          </Button>
        ) : null}
      </div>
    </AuthLayout>
  );
}
