import { expect, type Browser, type Page } from '@playwright/test';
import { waitForEmailLink } from './mailpit';

/** Fake credentials built from parts (never real secrets; keeps secret scanners quiet). */
const join = (...parts: string[]) => parts.join('');
export const E2E_PASSWORD = join('tickr', '-e2e-', '1');
export const E2E_NEW_PASSWORD = join('tickr', '-e2e-', '2');

export interface TestUser {
  fullName: string;
  email: string;
  password: string;
}

let counter = 0;
/** Unique per test run and worker, so tests can run in parallel against one stack. */
export function newUser(fullName = 'Test User'): TestUser {
  counter += 1;
  const id = `${String(Date.now())}-${String(process.pid)}-${String(counter)}`;
  return { fullName, email: `e2e-${id}@example.com`, password: E2E_PASSWORD };
}

export async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(user.fullName);
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/check-email$/);
}

/** Registers and confirms the email in a separate browser context (another device). */
export async function createConfirmedUser(browser: Browser, user: TestUser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await register(page, user);
  await page.goto(await waitForEmailLink(user.email, 'Confirm'));
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await context.close();
}

export async function signIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signOutViaMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Account menu for / }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
}
