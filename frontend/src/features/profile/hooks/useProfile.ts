import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getMyProfile, updateMyProfile, type Profile, type ProfilePatch } from '../api/profile';

export const profileKeys = {
  me: (userId: string) => ['profile', userId] as const,
};

function useUserId(): string | null {
  const auth = useAuth();
  return auth.status === 'signedIn' ? auth.session.user.id : null;
}

export function useMyProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.me(userId ?? 'anonymous'),
    queryFn: () => getMyProfile(userId ?? ''),
    enabled: userId !== null,
  });
}

export function useUpdateMyProfile() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => {
      if (!userId) throw new Error('Not signed in');
      return updateMyProfile(userId, patch);
    },
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData(profileKeys.me(profile.id), profile);
    },
  });
}
