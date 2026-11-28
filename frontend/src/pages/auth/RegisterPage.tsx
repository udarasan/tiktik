import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { signUp } from '@/features/auth/api/auth';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useCaptcha } from '@/features/auth/components/Captcha';
import { FormField } from '@/features/auth/components/FormField';
import { PasswordRules } from '@/features/auth/components/PasswordRules';
import { registerSchema, type RegisterValues } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';

/** FR-AUTH-01. After sign-up the user must confirm their email (FR-AUTH-07). */
export function RegisterPage() {
  const navigate = useNavigate();
  const captcha = useCaptcha();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp({ ...values, captchaToken: captcha.token });
      void navigate('/check-email', { state: { email: values.email } });
    } catch (e) {
      const err = toAppError(e);
      if (err.details.sourceCode === 'weak_password') {
        setError('password', { message: 'Choose a stronger password.' });
      } else if (err.code === 'RATE_LIMITED') {
        setFormError('Too many attempts. Please wait a moment and try again.');
      } else {
        setFormError(err.message);
      }
    } finally {
      captcha.reset();
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      description="Plan and track work with your team."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </span>
      }
    >
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          label="Full name"
          autoComplete="name"
          error={errors.fullName}
          {...register('fullName')}
        />
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
          autoComplete="new-password"
          error={errors.password}
          hint={<PasswordRules value={password} />}
          {...register('password')}
        />
        {captcha.element}
        <Button type="submit" disabled={isSubmitting || !captcha.ready}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
