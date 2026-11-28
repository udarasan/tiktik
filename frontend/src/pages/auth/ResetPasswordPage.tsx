import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { setNewPassword, verifyEmailLink } from '@/features/auth/api/auth';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { FormField } from '@/features/auth/components/FormField';
import { PasswordRules } from '@/features/auth/components/PasswordRules';
import { newPasswordSchema, type NewPasswordValues } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { toAppError } from '@/lib/errors';

/** FR-AUTH-06: /reset-password?token_hash=…&type=recovery → choose a new password. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const started = useRef(false);
  const tokenHash = params.get('token_hash');
  const hasLink = Boolean(tokenHash) && params.get('type') === 'recovery';
  // Never show the form until the link is verified, even if a session already exists
  // (a used or expired link must not look valid).
  const [link, setLink] = useState<'none' | 'verifying' | 'verified' | 'failed'>(
    hasLink ? 'verifying' : 'none',
  );

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const password = useWatch({ control, name: 'password' });

  useEffect(() => {
    if (started.current || !hasLink || !tokenHash) return;
    started.current = true;
    verifyEmailLink(tokenHash, 'recovery').then(
      () => {
        setLink('verified');
      },
      () => {
        setLink('failed');
      },
    );
  }, [hasLink, tokenHash]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await setNewPassword(values.password);
      toast.success('Password updated.');
      void navigate('/', { replace: true });
    } catch (e) {
      const err = toAppError(e);
      if (err.details.sourceCode === 'same_password') {
        setError('password', { message: 'Choose a password you have not used here before.' });
      } else if (err.details.sourceCode === 'weak_password') {
        setError('password', { message: 'Choose a stronger password.' });
      } else {
        setFormError(err.message);
      }
    }
  });

  const footer = (
    <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
      Back to sign in
    </Link>
  );

  if (link === 'failed' || (link === 'none' && auth.status === 'signedOut')) {
    return (
      <AuthLayout title="Link expired or invalid" footer={footer}>
        <p>
          This reset link can't be used. It may have expired (links last 30 minutes) or already been
          used.{' '}
          <Link to="/forgot-password" className="font-medium underline underline-offset-4">
            Request a new link
          </Link>
          .
        </p>
      </AuthLayout>
    );
  }

  if (link === 'verifying' || auth.status !== 'signedIn') {
    return (
      <AuthLayout title="Checking your link…">
        <p role="status" className="text-muted-foreground">
          One moment.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" footer={footer}>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          hint={<PasswordRules value={password} />}
          {...register('password')}
        />
        <FormField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm}
          {...register('confirm')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
