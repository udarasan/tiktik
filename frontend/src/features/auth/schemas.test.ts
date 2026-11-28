import { loginSchema, newPasswordSchema, registerSchema } from './schemas';
import {
  NO_DIGIT_PASSWORD,
  NO_LETTER_PASSWORD,
  OTHER_TEST_PASSWORD,
  TEST_PASSWORD,
  TOO_LONG_PASSWORD,
  TOO_SHORT_PASSWORD,
} from '@/test/fixtures';

const valid = { fullName: 'Alice Doe', email: 'alice@example.com', password: TEST_PASSWORD };

describe('registerSchema (FR-AUTH-01)', () => {
  it('accepts a valid sign-up and trims name and email', () => {
    expect(registerSchema.parse({ ...valid, fullName: '  Alice  ', email: ' a@b.co ' })).toEqual({
      ...valid,
      fullName: 'Alice',
      email: 'a@b.co',
    });
  });

  it.each([
    ['too short', TOO_SHORT_PASSWORD, /at least 8/],
    ['no digit', NO_DIGIT_PASSWORD, /number/],
    ['no letter', NO_LETTER_PASSWORD, /letter/],
    ['over 72 characters', TOO_LONG_PASSWORD, /at most 72/],
  ])('rejects a password that is %s', (_label, password, message) => {
    const result = registerSchema.safeParse({ ...valid, password });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message).join(' ')).toMatch(message);
  });

  it.each([
    ['blank name', { fullName: '   ' }, /Enter your name/],
    ['name over 100', { fullName: 'x'.repeat(101) }, /at most 100/],
    ['bad email', { email: 'not-an-email' }, /valid email/],
  ])('rejects %s', (_label, patch, message) => {
    const result = registerSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(message);
  });
});

describe('loginSchema (FR-AUTH-02)', () => {
  it('does not apply the password policy on login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
});

describe('newPasswordSchema (FR-AUTH-06)', () => {
  it('requires both passwords to match', () => {
    const result = newPasswordSchema.safeParse({
      password: TEST_PASSWORD,
      confirm: OTHER_TEST_PASSWORD,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['confirm']);
  });
});
