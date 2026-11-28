import { cn } from 'cn';
import { initials } from '../initials';

interface UserAvatarProps {
  name: string | null | undefined;
  className?: string;
}

/** FR-AUTH-08: initials avatar (uploads are out of MVP scope). Decorative; name is shown elsewhere. */
export function UserAvatar({ name, className }: UserAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
