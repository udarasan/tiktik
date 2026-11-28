import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormField } from '@/features/auth/components/FormField';
import { toAppError } from '@/lib/errors';
import { useUiStore } from '@/stores/ui';
import type { Profile } from '../api/profile';
import { useUpdateMyProfile } from '../hooks/useProfile';
import { profileSchema, type ProfileFormInput, type ProfileFormValues } from '../schemas';
import { browserTimeZone, timeZoneOptions } from '../timeZones';

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

/** FR-AUTH-08 (name, job title) and FR-AUTH-09 (time zone, theme). */
export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateMyProfile();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const zones = useMemo(() => timeZoneOptions(), []);
  const suggested = browserTimeZone();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile.full_name,
      job_title: profile.job_title ?? '',
      time_zone: profile.time_zone,
      theme,
    },
  });

  const onSubmit = handleSubmit(async ({ theme: nextTheme, ...patch }) => {
    try {
      // Theme is applied locally and saved by useThemeSync (single writer for the theme column).
      setTheme(nextTheme);
      const saved = await update.mutateAsync(patch);
      reset({ ...patch, job_title: saved.job_title ?? '', theme: nextTheme });
      toast.success('Profile saved.');
    } catch (e) {
      const err = toAppError(e);
      toast.error(
        err.code === 'VALIDATION_ERROR'
          ? 'Some details are not valid. Check and try again.'
          : err.message,
      );
    }
  });

  const zoneId = 'profile-time-zone';
  const themeId = 'profile-theme';

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
      <FormField
        label="Full name"
        autoComplete="name"
        error={errors.full_name}
        {...register('full_name')}
      />
      <FormField
        label="Job title"
        autoComplete="organization-title"
        placeholder="e.g. Product designer"
        error={errors.job_title}
        {...register('job_title')}
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={zoneId}>Time zone</Label>
          {suggested && suggested !== profile.time_zone ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4"
              onClick={() => {
                setValue('time_zone', suggested, { shouldDirty: true });
              }}
            >
              Use {suggested}
            </button>
          ) : null}
        </div>
        <select id={zoneId} className={selectClass} {...register('time_zone')}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Used for due-soon and overdue dates.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={themeId}>Theme</Label>
        <select id={themeId} className={selectClass} {...register('theme')}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div>
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
