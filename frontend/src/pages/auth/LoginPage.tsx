import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { resendConfirmation, signIn } from '@/features/auth/api/auth';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useCaptcha } from '@/features/auth/components/Captcha';
import { FormField } from '@/features/auth/components/FormField';
import { safeNextPath } from '@/features/auth/redirect';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';

type FormProblem = { kind: 'message'; text: string } | { kind: 'unconfirmed'; email: string };

/** FR-AUTH-02, FR-AUTH-11. Wrong email or password → one generic message. */
export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const captcha = useCaptcha();
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      await signIn({ ...values, captchaToken: captcha.token });
      void navigate(safeNextPath(params.get('next')), { replace: true });
    } catch (e) {
      const err = toAppError(e);
      if (err.details.sourceCode === 'email_not_confirmed') {
        setProblem({ kind: 'unconfirmed', email: values.email });
      } else if (err.code === 'RATE_LIMITED') {
        setProblem({
          kind: 'message',
          text: 'Too many attempts. Please wait a moment and try again.',
        });
      } else if (err.code === 'UNAUTHENTICATED' || err.code === 'VALIDATION_ERROR') {
        setProblem({ kind: 'message', text: 'Email or password is incorrect.' });
      } else {
        setProblem({ kind: 'message', text: err.message });
      }
    } finally {
      captcha.reset();
    }
  });

  const resend = async (email: string) => {
    try {
      await resendConfirmation(email);
      toast.success('Confirmation email sent. Check your inbox.');
    } catch (e) {
      const err = toAppError(e);
      toast.error(
        err.code === 'RATE_LIMITED' ? 'Please wait a minute before resending.' : err.message,
      );
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back to Tickr."
      footer={
        <span>
          New to Tickr?{' '}
          <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </span>
      }
    >
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {problem ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {problem.kind === 'message' ? (
                problem.text
              ) : (
                <span>
                  Please confirm your email address first.{' '}
                  <button
                    type="button"
                    className="font-medium underline underline-offset-4"
                    onClick={() => void resend(problem.email)}
                  >
                    Resend confirmation email
                  </button>
                </span>
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register('email')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          labelAside={
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              Forgot password?
            </Link>
          }
          {...register('password')}
        />
        {captcha.element}
        <Button type="submit" disabled={isSubmitting || !captcha.ready}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
