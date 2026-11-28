import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-2">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        It may have been moved, or you may not have access.{' '}
        <Link to="/" className="font-medium text-foreground underline underline-offset-4">
          Go to dashboard
        </Link>
      </p>
    </section>
  );
}
