import { z } from 'zod';
import { fullNameSchema } from '@/features/auth/schemas';

export const profileSchema = z.object({
  full_name: fullNameSchema,
  job_title: z
    .string()
    .trim()
    .max(100, 'Use at most 100 characters')
    .transform((v) => (v === '' ? null : v)),
  time_zone: z.string().min(1, 'Choose a time zone'),
  theme: z.enum(['light', 'dark', 'system']),
});

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormValues = z.output<typeof profileSchema>;
