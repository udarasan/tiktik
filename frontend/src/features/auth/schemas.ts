import { z } from 'zod';

/** FR-AUTH-01 password policy. Upper bound is Supabase Auth's 72-byte (bcrypt) limit, not the plan's 128. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export const passwordRules = [
  {
    id: 'length',
    label: `${String(PASSWORD_MIN)}–${String(PASSWORD_MAX)} characters`,
    test: (v: string) => v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX,
  },
  { id: 'letter', label: 'At least one letter', test: (v: string) => /\p{L}/u.test(v) },
  { id: 'digit', label: 'At least one number', test: (v: string) => /\d/.test(v) },
] as const;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${String(PASSWORD_MIN)} characters`)
  .max(PASSWORD_MAX, `Use at most ${String(PASSWORD_MAX)} characters`)
  .regex(/\p{L}/u, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name')
  .max(100, 'Use at most 100 characters');

export const loginSchema = z.object({
  email: emailSchema,
  // Don't validate the policy on login: old passwords may predate it, and errors must stay generic.
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    error: 'Passwords do not match',
    path: ['confirm'],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
