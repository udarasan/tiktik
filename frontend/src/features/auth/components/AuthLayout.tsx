import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card used by every public auth page (plan §11.3 Login, Registration). */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
          >
            T
          </span>
          <span className="text-lg font-semibold">Tickr</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-lg">{title}</h1>
            </CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer ? (
            <CardFooter className="justify-center text-sm text-muted-foreground">
              {footer}
            </CardFooter>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
