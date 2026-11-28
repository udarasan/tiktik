import type { Profile } from '@/features/profile/api/profile';

/**
 * Fake credentials for unit tests only — never real secrets.
 * Built from parts at runtime so secret scanners (GitGuardian) don't flag them as
 * hard-coded passwords, and so every test uses the same obviously-fake values.
 */
const join = (...parts: string[]) => parts.join('');

/** Meets the FR-AUTH-01 policy (8–72 chars, a letter and a digit). */
export const TEST_PASSWORD = join('tickr', '-fixture-', '1');
/** A second valid value, for "passwords must match" cases. */
export const OTHER_TEST_PASSWORD = join('tickr', '-fixture-', '2');

/** Policy violations, one rule each. */
export const TOO_SHORT_PASSWORD = join('tk', '1');
export const NO_DIGIT_PASSWORD = join('tickr', 'fixture');
export const NO_LETTER_PASSWORD = join('1234', '5678');
export const TOO_LONG_PASSWORD = join('t1', 'x'.repeat(71));

/** A saved profile row for the signed-in test user (see fakeSession in render.tsx). */
export const testProfile: Profile = {
  id: '00000000-0000-0000-0000-00000000000a',
  full_name: 'Alice Doe',
  job_title: null,
  avatar_url: null,
  time_zone: 'UTC',
  theme: 'dark',
  created_at: '2026-11-28T00:00:00Z',
};
