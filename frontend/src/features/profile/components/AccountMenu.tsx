import { LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/features/auth/api/auth';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { toAppError } from '@/lib/errors';
import { useMyProfile } from '../hooks/useProfile';
import { UserAvatar } from './UserAvatar';

/** Top-bar account menu: profile & settings, sign out (FR-AUTH-03). */
export function AccountMenu() {
  const auth = useAuth();
  const { data: profile } = useMyProfile();
  const [signingOut, setSigningOut] = useState(false);
  const email = auth.status === 'signedIn' ? auth.session.user.email : undefined;
  const name = profile?.full_name;

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(); // AuthProvider clears cached data; RequireAuth redirects to /login.
      toast.success('Signed out.');
    } catch (e) {
      toast.error(toAppError(e).message);
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={name ? `Account menu for ${name}` : 'Account menu'}
      >
        {name ? (
          <UserAvatar name={name} />
        ) : (
          // Neutral placeholder while the profile loads (don't derive initials from the email).
          <span aria-hidden className="block size-8 animate-pulse rounded-full bg-muted" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{profile?.full_name ?? 'Your account'}</span>
          {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/me">
            <UserRound />
            Profile & settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(e) => {
            e.preventDefault();
            void onSignOut();
          }}
        >
          <LogOut />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
