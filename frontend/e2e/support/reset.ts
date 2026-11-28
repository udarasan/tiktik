import { expect, type Page } from '@playwright/test';

/**
 * Submits the forgot-password form and waits for its outcome. On failure, the error says
 * what actually happened (Auth response status/body and any on-screen alert), so a CI
 * failure is diagnosable from the annotation alone.
 */
export async function requestPasswordReset(page: Page, email: string): Promise<void> {
  await page.getByLabel('Email', { exact: true }).fill(email);
  const response = page.waitForResponse((r) => r.url().includes('/auth/v1/recover'), {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Send reset link' }).click();

  const res = await response.catch(() => null);
  const success = page.getByText(`If an account exists for ${email}`);
  const alert = page.getByRole('alert');
  await expect(success.or(alert)).toBeVisible();

  if (await alert.isVisible()) {
    const body = res ? (await res.text().catch(() => '')).slice(0, 300) : 'no response';
    throw new Error(
      `Reset request failed. Auth /recover → ${res ? String(res.status()) : 'none'} ${body}. ` +
        `On screen: "${((await alert.textContent()) ?? '').trim()}"`,
    );
  }
}
