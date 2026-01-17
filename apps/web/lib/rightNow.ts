// apps/web/lib/rightNow.ts

export type TaskSource = "canvas" | "schedule";

export interface RightNowTask {
  id: string;
  title: string;
  source: TaskSource;
  urgency: number; // higher = more important
}

/**
 * Simple AI-like prioritisation
 */
export function pickNextTask(
  canvasTasks: RightNowTask[],
  scheduleTasks: RightNowTask[]
): RightNowTask | null {
  const now = Date.now();

  const allTasks = [...canvasTasks, ...scheduleTasks];

  if (allTasks.length === 0) return null;

  const scored = allTasks.map((task) => {
    let score = task.importance * 10;

    if (task.dueAt) {
      const hoursLeft = (task.dueAt - now) / 36e5;
      if (hoursLeft <= 24) score += 30;
      else if (hoursLeft <= 72) score += 15;
    }

    if (task.source === "Schedule") score += 5;

    return { task, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0].task;
}
