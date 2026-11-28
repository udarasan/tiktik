import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { changePassword } from '@/features/auth/api/auth';
import { FormField } from '@/features/auth/components/FormField';
import { PasswordRules } from '@/features/auth/components/PasswordRules';
import { changePasswordSchema, type ChangePasswordValues } from '@/features/auth/schemas';
import { toAppError } from '@/lib/errors';

const EMPTY: ChangePasswordValues = { currentPassword: '', newPassword: '', confirm: '' };

/** FR-AUTH-05: requires the current password; other sessions are signed out afterwards. */
export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });
  const newPassword = useWatch({ control, name: 'newPassword' });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword: next }) => {
    try {
      await changePassword({ currentPassword, newPassword: next });
      reset(EMPTY);
      toast.success('Password changed. Other devices have been signed out.');
    } catch (e) {
      const err = toAppError(e);
      const source = err.details.sourceCode;
      if (source === 'current_password_invalid' || source === 'current_password_required') {
        setError('currentPassword', { message: 'Current password is incorrect.' });
      } else if (source === 'same_password') {
        setError('newPassword', { message: 'Choose a different password from your current one' });
      } else if (source === 'weak_password') {
        setError('newPassword', { message: 'Choose a stronger password.' });
      } else if (err.code === 'RATE_LIMITED') {
        toast.error('Too many attempts. Please wait a moment and try again.');
      } else {
        toast.error(err.message);
      }
    }
  });

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
      <FormField
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword}
        {...register('currentPassword')}
      />
      <FormField
        label="New password"
        type="password"
        autoComplete="new-password"
        error={errors.newPassword}
        hint={<PasswordRules value={newPassword} />}
        {...register('newPassword')}
      />
      <FormField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirm}
        {...register('confirm')}
      />
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}
