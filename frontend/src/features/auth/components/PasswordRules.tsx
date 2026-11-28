import { Check, X } from 'lucide-react';
import { cn } from 'cn';
import { passwordRules } from '../schemas';

/** Live password strength hint (plan §11.3 Registration). Never relies on colour alone. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="flex flex-col gap-1 text-xs" aria-label="Password requirements">
      {passwordRules.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-1.5',
              ok ? 'text-status-done' : 'text-muted-foreground',
            )}
          >
            {ok ? (
              <Check aria-hidden className="size-3.5" />
            ) : (
              <X aria-hidden className="size-3.5" />
            )}
            <span>
              {rule.label}
              <span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
