import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { requestPasswordReset } from '@/features/auth/api/auth';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useCaptcha } from '@/features/auth/components/Captcha';
import { FormField } from '@/features/auth/components/FormField';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';

/** FR-AUTH-06: the response is identical whether or not the email exists. */
export function ForgotPasswordPage() {
  const captcha = useCaptcha();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await requestPasswordReset({ email, captchaToken: captcha.token });
      setSentTo(email);
    } catch (e) {
      const err = toAppError(e);
      // Only rate limiting is surfaced; anything else looks like success (no account enumeration).
      if (err.code === 'RATE_LIMITED') {
        setFormError('Too many requests. Please wait a minute and try again.');
      } else {
        setSentTo(email);
      }
    } finally {
      captcha.reset();
    }
  });

  const footer = (
    <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
      Back to sign in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={footer}>
        <p>
          If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset your
          password. The link expires in 30 minutes.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
      footer={footer}
    >
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register('email')}
        />
        {captcha.element}
        <Button type="submit" disabled={isSubmitting || !captcha.ready}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
