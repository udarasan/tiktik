import { readPublicEnv } from './env';

const valid = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
};

describe('readPublicEnv (CLAUDE.md rule 8)', () => {
  it('returns the URL and publishable key', () => {
    expect(readPublicEnv(valid)).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabasePublishableKey: 'sb_publishable_abc123',
    });
  });

  it('rejects a missing or invalid URL', () => {
    expect(() => readPublicEnv({ ...valid, VITE_SUPABASE_URL: undefined })).toThrow(/URL/);
    expect(() => readPublicEnv({ ...valid, VITE_SUPABASE_URL: 'localhost' })).toThrow(/URL/);
  });

  it('rejects a missing key', () => {
    expect(() => readPublicEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toThrow(/missing/);
  });

  it('refuses a secret key in the browser', () => {
    expect(() =>
      readPublicEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_xyz' }),
    ).toThrow(/SECRET/);
  });

  it('refuses legacy anon / service_role JWT keys', () => {
    expect(() =>
      readPublicEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.x.y' }),
    ).toThrow(/legacy/);
  });
});
