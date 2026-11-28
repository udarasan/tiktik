import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { appUrl } from '../redirect';

/**
 * All Supabase Auth calls (CLAUDE.md rule 10). Every error is thrown as an AppError (rule 6).
 * Plan §9.2.
 */

const captcha = (token: string | undefined) => (token ? { captchaToken: token } : {});

export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
  captchaToken?: string | undefined;
}): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo: appUrl('/auth/confirm'),
      ...captcha(input.captchaToken),
    },
  });
  if (error) throw toAppError(error);
  // With email confirmation on, Supabase returns no session (and does not reveal existing emails).
}

export async function signIn(input: {
  email: string;
  password: string;
  captchaToken?: string | undefined;
}): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    options: captcha(input.captchaToken),
  });
  if (error) throw toAppError(error);
}

/** FR-AUTH-03: revokes this session's refresh token server-side and clears local storage. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw toAppError(error);
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: appUrl('/auth/confirm') },
  });
  if (error) throw toAppError(error);
}

/** FR-AUTH-06: callers show the same message whether or not the email exists. */
export async function requestPasswordReset(input: {
  email: string;
  captchaToken?: string | undefined;
}): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: appUrl('/reset-password'),
    ...captcha(input.captchaToken),
  });
  if (error) throw toAppError(error);
}

/** Verifies a link from a Tickr email (`?token_hash=…&type=…`) and starts a session. */
export async function verifyEmailLink(
  tokenHash: string,
  type: 'email' | 'recovery',
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) throw toAppError(error);
}

/** Sets a new password during a recovery session (no current password needed). */
export async function setNewPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw toAppError(error);
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw toAppError(error);
  return data.session;
}

export function onAuthChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => {
    data.subscription.unsubscribe();
  };
}
