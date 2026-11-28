import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useCallback, useRef, useState } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';

/**
 * FR-AUTH-11: Cloudflare Turnstile on sign-in, sign-up and password reset.
 * Disabled (renders nothing, token undefined) when VITE_TURNSTILE_SITE_KEY is not set,
 * e.g. locally and in CI where Supabase Auth has CAPTCHA off.
 */
export function useCaptcha() {
  const ref = useRef<TurnstileInstance>(null);
  const [token, setToken] = useState<string | undefined>(undefined);
  const enabled = SITE_KEY !== '';

  // Tokens are single-use: reset after every submit attempt.
  const reset = useCallback(() => {
    setToken(undefined);
    ref.current?.reset();
  }, []);

  const element = enabled ? (
    <Turnstile
      ref={ref}
      siteKey={SITE_KEY}
      options={{ size: 'flexible', theme: 'auto' }}
      onSuccess={setToken}
      onExpire={() => {
        setToken(undefined);
      }}
      onError={() => {
        setToken(undefined);
      }}
    />
  ) : null;

  return { enabled, token, ready: !enabled || token !== undefined, reset, element };
}
