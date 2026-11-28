import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { verifyEmailLink } from '@/features/auth/api/auth';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * Landing page for the confirmation link (FR-AUTH-07): /auth/confirm?token_hash=…&type=email.
 * Also handles a PKCE `?code=` link, which supabase-js exchanges automatically.
 */
export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [failed, setFailed] = useState(Boolean(params.get('error_description')));
  const started = useRef(false);

  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  useEffect(() => {
    if (started.current || !tokenHash || (type !== 'email' && type !== 'signup')) return;
    started.current = true;
    verifyEmailLink(tokenHash, 'email').catch(() => {
      setFailed(true);
    });
  }, [tokenHash, type]);

  useEffect(() => {
    if (auth.status === 'signedIn' && !failed) {
      toast.success('Email confirmed. Welcome to Tickr!');
      void navigate('/', { replace: true });
    }
  }, [auth.status, failed, navigate]);

  const nothingToVerify = !tokenHash && !params.get('code') && auth.status === 'signedOut';

  if (failed || nothingToVerify) {
    return (
      <AuthLayout
        title="Link expired or invalid"
        footer={
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <p>
          This confirmation link can't be used. It may have expired or already been used. Sign in to
          request a new one.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Confirming your email…">
      <p role="status" className="text-muted-foreground">
        One moment.
      </p>
    </AuthLayout>
  );
}
