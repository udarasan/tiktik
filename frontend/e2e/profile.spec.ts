import { expect, test } from '@playwright/test';
import { storedRefreshToken, tryRefresh } from './support/session';
import { createConfirmedUser, E2E_NEW_PASSWORD, newUser, signIn } from './support/users';

test.describe('Profile and settings', () => {
  test('FR-AUTH-08/09 edit profile; changes persist; theme follows the user to another device', async ({
    browser,
  }) => {
    const user = newUser('Morgan Lee');
    await createConfirmedUser(browser, user);

    const deviceA = await browser.newContext({ colorScheme: 'light' });
    const a = await deviceA.newPage();
    await signIn(a, user);
    await a.getByRole('button', { name: 'Account menu for Morgan Lee' }).click();
    await a.getByRole('menuitem', { name: 'Profile & settings' }).click();
    await expect(a.getByLabel('Full name')).toHaveValue('Morgan Lee');

    await a.getByLabel('Full name').fill('Morgan R. Lee');
    await a.getByLabel('Job title').fill('Product designer');
    await a.getByLabel('Time zone').selectOption('Asia/Colombo');
    await a.getByLabel('Theme', { exact: true }).selectOption('dark');
    await a.getByRole('button', { name: 'Save profile' }).click();
    await expect(a.getByText('Profile saved.')).toBeVisible();

    await a.reload();
    await expect(a.getByLabel('Full name')).toHaveValue('Morgan R. Lee');
    await expect(a.getByLabel('Job title')).toHaveValue('Product designer');
    await expect(a.getByLabel('Time zone')).toHaveValue('Asia/Colombo');
    await expect(a.locator('html')).toHaveClass(/\bdark\b/);

    await a.getByLabel('Full name').fill('');
    await a.getByRole('button', { name: 'Save profile' }).click();
    await expect(a.getByText('Enter your name')).toBeVisible();

    // Another device that prefers light gets the saved dark theme.
    const deviceB = await browser.newContext({ colorScheme: 'light' });
    const b = await deviceB.newPage();
    await signIn(b, user);
    await expect(b.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(b.locator('html')).toHaveClass(/\bdark\b/);

    await deviceA.close();
    await deviceB.close();
  });

  test('FR-AUTH-05 change password needs the current one and signs out other devices', async ({
    browser,
  }) => {
    const user = newUser();
    await createConfirmedUser(browser, user);

    const deviceA = await browser.newContext();
    const a = await deviceA.newPage();
    await signIn(a, user);
    await expect(a.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const refreshA = await storedRefreshToken(a);

    const deviceB = await browser.newContext();
    const b = await deviceB.newPage();
    await signIn(b, user);
    await expect(b.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await b.goto('/me');

    await b.getByLabel('Current password').fill(E2E_NEW_PASSWORD);
    await b.getByLabel('New password', { exact: true }).fill(`${E2E_NEW_PASSWORD}x`);
    await b.getByLabel('Confirm new password').fill(`${E2E_NEW_PASSWORD}x`);
    await b.getByRole('button', { name: 'Change password' }).click();
    await expect(b.getByText('Current password is incorrect.')).toBeVisible();

    await b.getByLabel('Current password').fill(user.password);
    await b.getByLabel('New password', { exact: true }).fill(E2E_NEW_PASSWORD);
    await b.getByLabel('Confirm new password').fill(E2E_NEW_PASSWORD);
    await b.getByRole('button', { name: 'Change password' }).click();
    await expect(
      b.getByText('Password changed. Other devices have been signed out.'),
    ).toBeVisible();

    // Device A's refresh token was revoked server-side.
    expect(await tryRefresh(refreshA)).toEqual({ status: 400, code: 'refresh_token_not_found' });
    // Device B (the one that changed it) stays signed in.
    await b.reload();
    await expect(b.getByRole('heading', { name: 'Profile and settings' })).toBeVisible();

    await deviceA.close();
    await deviceB.close();
  });
});
