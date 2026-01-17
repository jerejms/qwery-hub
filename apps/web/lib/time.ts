// apps/web/lib/time.ts
export function getSingaporeNow(base: Date = new Date()): Date {
  // Convert base time -> UTC -> UTC+8
  const utcMs = base.getTime() + base.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 8 * 60 * 60_000);
}

export function minutesFromHHMM(hhmm: string): number {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(2), 10);
  return h * 60 + m;
}

export const DAY_TO_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};
