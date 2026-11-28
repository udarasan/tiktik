import type { Session } from '@supabase/supabase-js';
import { createContext } from 'react';

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session };

export const AuthContext = createContext<AuthState | null>(null);
