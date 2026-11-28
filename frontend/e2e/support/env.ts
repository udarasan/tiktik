import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Reads frontend/.env.local (written by `npm run env:local`), overridable by real env vars. */
function readEnvLocal(): Record<string, string> {
  try {
    const text = readFileSync(fileURLToPath(new URL('../../.env.local', import.meta.url)), 'utf8');
    return Object.fromEntries(
      text
        .split('\n')
        .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => [m[1] ?? '', m[2] ?? '']),
    );
  } catch {
    return {};
  }
}

const local = readEnvLocal();
const pick = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? local[key] ?? fallback;
  if (!value)
    throw new Error(`${key} is not set. Run \`npm run env:local\` with the stack running.`);
  return value;
};

export const env = {
  supabaseUrl: pick('VITE_SUPABASE_URL'),
  publishableKey: pick('VITE_SUPABASE_PUBLISHABLE_KEY'),
  mailpitUrl: pick('MAILPIT_URL', 'http://127.0.0.1:54324'),
};
