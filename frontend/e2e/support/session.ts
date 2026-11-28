import type { Page } from '@playwright/test';
import { env } from './env';

/** The refresh token supabase-js stored for this page (localStorage `sb-…-auth-token`). */
export async function storedRefreshToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'));
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) throw new Error('No Supabase session in localStorage');
    return (JSON.parse(raw) as { refresh_token: string }).refresh_token;
  });
}

/** Tries to refresh a session directly against Auth; returns the HTTP status and error code. */
export async function tryRefresh(refreshToken: string): Promise<{ status: number; code?: string }> {
  const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.publishableKey },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = (await res.json()) as { error_code?: string };
  return { status: res.status, ...(body.error_code ? { code: body.error_code } : {}) };
}
