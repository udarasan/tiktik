import {
  AppError,
  BUSINESS_ERROR_CODES,
  GENERAL_ERROR_CODES,
  isAppError,
  toAppError,
} from './errors';

// Shapes below mirror what supabase-js returns (PostgrestError, AuthApiError, FunctionsHttpError body).
const rpcError = (message: string, hint?: string) => ({
  code: 'P0001',
  message,
  details: null,
  hint: hint ?? null,
});
const pgError = (code: string, message = 'db error') => ({
  code,
  message,
  details: null,
  hint: null,
});
const authError = (code: string | undefined, status: number) => ({
  __isAuthError: true,
  name: 'AuthApiError',
  code,
  status,
  message: 'auth error',
});

describe('toAppError — RPC business errors (P0001)', () => {
  it.each([...BUSINESS_ERROR_CODES])('maps P0001 %s to the same code', (code) => {
    const err = toAppError(rpcError(code));
    expect(err.code).toBe(code);
    expect(err.details.sourceCode).toBe('P0001');
  });

  it.each(['VERSION_MISMATCH', 'PROJECT_ARCHIVED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR'])(
    'maps a general code raised by an RPC (%s)',
    (code) => {
      expect(toAppError(rpcError(code)).code).toBe(code);
    },
  );

  it('uses the RPC hint as the user-facing message', () => {
    const err = toAppError(rpcError('LAST_PROJECT_MANAGER', 'Promote another member first'));
    expect(err.code).toBe('LAST_PROJECT_MANAGER');
    expect(err.message).toBe('Promote another member first');
  });

  it('falls back to a default message when there is no hint', () => {
    const err = toAppError(rpcError('VERSION_MISMATCH'));
    expect(err.message).toMatch(/someone else changed this/i);
  });

  it('turns an unknown P0001 code into INTERNAL_ERROR and keeps it for logs', () => {
    const err = toAppError(rpcError('SOMETHING_NEW'));
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.details.unknownCode).toBe('SOMETHING_NEW');
  });
});

describe('toAppError — Postgres / PostgREST codes (plan §7.7)', () => {
  it.each([
    ['42501', 'FORBIDDEN'],
    ['23505', 'CONFLICT'],
    ['23503', 'VALIDATION_ERROR'],
    ['23514', 'VALIDATION_ERROR'],
    ['22P02', 'VALIDATION_ERROR'],
    ['PGRST116', 'NOT_FOUND'],
    ['PGRST301', 'UNAUTHENTICATED'],
    ['PGRST303', 'UNAUTHENTICATED'],
  ])('maps %s to %s', (source, expected) => {
    const err = toAppError(pgError(source));
    expect(err.code).toBe(expected);
    expect(err.details.sourceCode).toBe(source);
  });

  it('does not leak the raw database message to users', () => {
    const err = toAppError(pgError('23505', 'duplicate key value violates unique constraint "x"'));
    expect(err.message).not.toMatch(/duplicate key/);
  });
});

describe('toAppError — Supabase Auth', () => {
  it('maps Auth 429 to RATE_LIMITED', () => {
    expect(toAppError(authError(undefined, 429)).code).toBe('RATE_LIMITED');
    expect(toAppError(authError('over_email_send_rate_limit', 429)).code).toBe('RATE_LIMITED');
  });

  it.each([
    ['invalid_credentials', 400, 'UNAUTHENTICATED'],
    ['email_not_confirmed', 400, 'UNAUTHENTICATED'],
    ['refresh_token_already_used', 400, 'UNAUTHENTICATED'],
    ['user_already_exists', 422, 'CONFLICT'],
    ['weak_password', 422, 'VALIDATION_ERROR'],
    ['current_password_required', 400, 'VALIDATION_ERROR'],
    ['current_password_invalid', 400, 'VALIDATION_ERROR'],
    ['same_password', 422, 'VALIDATION_ERROR'],
    ['otp_expired', 403, 'VALIDATION_ERROR'],
  ])('maps %s (%i) to %s and keeps the auth code', (code, status, expected) => {
    const err = toAppError(authError(code, status));
    expect(err.code).toBe(expected);
    expect(err.details).toMatchObject({ sourceCode: code, status });
  });

  it('falls back to the HTTP status for unknown auth codes', () => {
    expect(toAppError(authError('something_new', 401)).code).toBe('UNAUTHENTICATED');
    expect(toAppError(authError('something_new', 500)).code).toBe('INTERNAL_ERROR');
  });
});

describe('toAppError — Edge Functions and other inputs', () => {
  it('accepts an Edge Function body { code, message, details }', () => {
    const err = toAppError({ code: 'FORBIDDEN', message: 'Not allowed', details: { id: 1 } });
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Not allowed');
    expect(err.details.info).toEqual({ id: 1 });
  });

  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
  ])('maps a bare HTTP %i to %s', (status, expected) => {
    expect(toAppError({ status }).code).toBe(expected);
  });

  it.each([
    ['a network TypeError', new TypeError('Failed to fetch')],
    ['a string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('maps %s to INTERNAL_ERROR', (_label, input) => {
    expect(toAppError(input).code).toBe('INTERNAL_ERROR');
  });

  it('returns an AppError unchanged', () => {
    const original = new AppError('CONFLICT', 'x');
    expect(toAppError(original)).toBe(original);
  });

  it('returns an Error subclass usable with TanStack Query', () => {
    const err = toAppError(pgError('42501'));
    expect(err).toBeInstanceOf(Error);
    expect(isAppError(err)).toBe(true);
    expect(err.name).toBe('AppError');
  });
});

describe('error code registry', () => {
  it('covers all general codes from plan §9.1', () => {
    expect([...GENERAL_ERROR_CODES].sort()).toEqual(
      [
        'CONFLICT',
        'FORBIDDEN',
        'INTERNAL_ERROR',
        'NOT_FOUND',
        'PROJECT_ARCHIVED',
        'RATE_LIMITED',
        'UNAUTHENTICATED',
        'VALIDATION_ERROR',
        'VERSION_MISMATCH',
      ].sort(),
    );
  });

  it('has no duplicates between general and business codes', () => {
    const all = [...GENERAL_ERROR_CODES, ...BUSINESS_ERROR_CODES];
    expect(new Set(all).size).toBe(all.length);
  });
});
