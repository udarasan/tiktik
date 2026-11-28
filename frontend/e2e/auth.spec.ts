import { expect, test } from '@playwright/test';
import { waitForEmailLink } from './support/mailpit';
import {
  createConfirmedUser,
  E2E_NEW_PASSWORD,
  newUser,
  register,
  signIn,
  signOutViaMenu,
} from './support/users';

test.describe('J1 (auth part): sign up, confirm, sign in, sign out', () => {
  test('FR-AUTH-01/07/02/03 new user signs up, confirms on another device, signs in and out', async ({
    page,
    browser,
  }) => {
    const user = newUser('Jordan Fields');

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    await register(page, user);
    await expect(page.getByText(user.email)).toBeVisible();

    // FR-AUTH-07: sign-in is blocked until the email is confirmed.
    await signIn(page, user);
    await expect(page.getByRole('alert')).toContainText('Please confirm your email address first.');

    // The link works in a different browser (token_hash template, not same-browser PKCE).
    const link = await waitForEmailLink(user.email, 'Confirm');
    expect(link).toMatch(/\/auth\/confirm\?token_hash=[^&]+&type=email$/);
    const otherDevice = await browser.newContext();
    const other = await otherDevice.newPage();
    await other.goto(link);
    await expect(other.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await other.reload();
    await expect(other.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await otherDevice.close();

    // FR-AUTH-02: now the original browser can sign in.
    await signIn(page, user);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account menu for Jordan Fields' })).toHaveText(
      'JF',
    );

    // FR-AUTH-03: sign out; protected pages redirect to login.
    await signOutViaMenu(page);
    await page.goto('/me');
    await expect(page).toHaveURL(/\/login\?next=%2Fme$/);
  });

  test('FR-AUTH-01 registration enforces the password policy in the form', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Weak Password');
    await page.getByLabel('Email', { exact: true }).fill(newUser().email);
    await page.getByLabel('Password', { exact: true }).fill(['only', 'letters'].join(''));
    const rules = page.getByRole('list', { name: 'Password requirements' });
    await expect(rules).toContainText('At least one letter (met)');
    await expect(rules).toContainText('At least one number (not met)');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Include at least one number')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('FR-AUTH-02 wrong credentials show one generic message; ?next= is honoured', async ({
    page,
    browser,
  }) => {
    const user = newUser();
    await createConfirmedUser(browser, user);

    await signIn(page, { email: user.email, password: E2E_NEW_PASSWORD });
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
    await signIn(page, { email: `nobody-${user.email}`, password: user.password });
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');

    await page.goto('/me');
    await expect(page).toHaveURL(/\/login\?next=%2Fme$/);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/me$/);
  });

  test('open redirects via ?next= are ignored', async ({ page, browser }) => {
    const user = newUser();
    await createConfirmedUser(browser, user);
    await page.goto('/login?next=%2F%2Fevil.example.com');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(new URL(page.url()).host).toBe('localhost:5180');
  });
});

test.describe('FR-AUTH-06 password reset', () => {
  test('reset by email on another device; link is single-use; old password stops working', async ({
    page,
    browser,
  }) => {
    const user = newUser();
    await createConfirmedUser(browser, user);

    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(`If an account exists for ${user.email}`)).toBeVisible();

    const link = await waitForEmailLink(user.email, 'Reset');
    expect(link).toMatch(/\/reset-password\?token_hash=[^&]+&type=recovery$/);

    const device = await browser.newContext();
    const reset = await device.newPage();
    await reset.goto(link);
    await reset.getByLabel('New password', { exact: true }).fill(E2E_NEW_PASSWORD);
    await reset.getByLabel('Confirm new password').fill(E2E_NEW_PASSWORD);
    await reset.getByRole('button', { name: 'Save new password' }).click();
    await expect(reset.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Single use, even in a tab that is already signed in.
    await reset.goto(link);
    await expect(reset.getByRole('heading', { name: 'Link expired or invalid' })).toBeVisible();
    await expect(reset.getByLabel('New password', { exact: true })).toHaveCount(0);
    await device.close();

    await signIn(page, user);
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
    await signIn(page, { email: user.email, password: E2E_NEW_PASSWORD });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('the response does not reveal whether an account exists', async ({ page }) => {
    await page.goto('/forgot-password');
    const email = newUser().email; // never registered
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(`If an account exists for ${email}`)).toBeVisible();
  });
});
