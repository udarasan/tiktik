import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ChangePasswordForm } from '@/features/profile/components/ChangePasswordForm';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { UserAvatar } from '@/features/profile/components/UserAvatar';
import { useMyProfile } from '@/features/profile/hooks/useProfile';

/** Plan §11.3 "Profile and settings" (moves to /w/:slug/me in M3). FR-AUTH-05, 08, 09. */
export function MePage() {
  const auth = useAuth();
  const { data: profile, isPending, isError, refetch } = useMyProfile();
  const email = auth.status === 'signedIn' ? auth.session.user.email : undefined;

  return (
    <section aria-labelledby="me-heading" className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        {profile ? (
          <UserAvatar name={profile.full_name} className="size-12 text-base" />
        ) : (
          <span aria-hidden className="block size-12 animate-pulse rounded-full bg-muted" />
        )}
        <div>
          <h1 id="me-heading" className="text-xl font-semibold">
            Profile and settings
          </h1>
          {email ? <p className="text-muted-foreground">{email}</p> : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Profile</h2>
          </CardTitle>
          <CardDescription>How teammates see you, and your time zone and theme.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div role="status" aria-label="Loading profile" className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : isError ? (
            <p role="alert">
              We couldn't load your profile.{' '}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => void refetch()}
              >
                Try again
              </button>
            </p>
          ) : (
            <ProfileForm profile={profile} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Password</h2>
          </CardTitle>
          <CardDescription>
            You'll need your current password. Other devices will be signed out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </section>
  );
}
