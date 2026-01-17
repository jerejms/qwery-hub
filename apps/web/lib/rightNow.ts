export type TaskSource = "canvas" | "schedule";

export interface RightNowTask {
  id: string;
  title: string;
  source: TaskSource;

  dueAtMs?: number;
  importance?: number;
  estimatedHours?: number;
  difficulty?: number;
}

export function pickNextTask(
  canvasTasks: RightNowTask[],
  scheduleTasks: RightNowTask[],
  opts?: { energy?: 1 | 2 | 3 | 4 | 5; nowMs?: number }
): RightNowTask | null {
  const now = opts?.nowMs ?? Date.now();
  const energy = opts?.energy ?? 3;

  const all = [...canvasTasks, ...scheduleTasks];
  if (all.length === 0) return null;

  let best: RightNowTask | null = null;
  let bestScore = -Infinity;

  for (const t of all) {
    const importance = t.importance ?? 3;
    const est = t.estimatedHours ?? 1;
    const diff = t.difficulty ?? 3;

    let score = importance * 10;

    if (t.dueAtMs) {
      const hoursLeft = (t.dueAtMs - now) / 36e5;
      if (hoursLeft <= 2) score += 60;
      else if (hoursLeft <= 24) score += 30;
      else if (hoursLeft <= 72) score += 15;
    }

    score -= (6 - energy) * (diff + est);

    if (t.source === "schedule") score += 3;

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  return best;
}
