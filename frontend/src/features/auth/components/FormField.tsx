import { useId, type ComponentProps, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormFieldProps extends ComponentProps<typeof Input> {
  label: string;
  error?: FieldError | undefined;
  hint?: ReactNode;
  labelAside?: ReactNode;
}

/** Label + input + field error under it (plan §11.6), wired for screen readers. */
export function FormField({ label, error, hint, labelAside, id, ...inputProps }: FormFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId}>{label}</Label>
        {labelAside}
      </div>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint ? <div id={hintId}>{hint}</div> : null}
      {error?.message ? (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
