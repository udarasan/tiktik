import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';

/** URL parameter that opens the task panel: /...?task=WEB-42 (plan §7.11). */
export const TASK_PARAM = 'task';

/**
 * Task panel slot (480 px). Plan §11.5:
 * ≥ 1280 px beside content · 768–1279 px overlays content · < 768 px full screen.
 * Content (fields, comments, activity) arrives in M5.
 */
export function TaskPanel() {
  const [params, setParams] = useSearchParams();
  const taskKey = params.get(TASK_PARAM);

  useEffect(() => {
    if (!taskKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete(TASK_PARAM);
            return next;
          },
          { replace: true },
        );
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [taskKey, setParams]);

  if (!taskKey) return null;

  const close = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(TASK_PARAM);
      return next;
    });
  };

  return (
    <aside
      aria-label={`Task ${taskKey}`}
      className="fixed inset-0 z-30 flex flex-col bg-background shadow-xl md:inset-y-0 md:right-0 md:left-auto md:w-[480px] md:border-l xl:static xl:z-auto xl:shadow-none"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="font-mono text-sm font-semibold">{taskKey}</h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close task panel">
          <X />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-muted-foreground">
        Task details arrive in M5.
      </div>
    </aside>
  );
}
