import { Link } from 'react-router';

export function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-heading" className="mx-auto flex max-w-3xl flex-col gap-2">
      <h1 id="dashboard-heading" className="text-xl font-semibold">
        Dashboard
      </h1>
      <p className="text-muted-foreground">
        Nothing here yet. Your tasks and project progress will appear here (M7).
      </p>
      <p className="text-muted-foreground">
        Preview the task panel:{' '}
        <Link
          to="?task=DEMO-1"
          className="font-medium text-foreground underline underline-offset-4"
        >
          open DEMO-1
        </Link>
      </p>
    </section>
  );
}
