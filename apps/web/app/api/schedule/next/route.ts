// apps/web/app/api/schedule/next/route.ts
import { NextResponse } from "next/server";
import { getTimetableFromShareLink } from "@/server/integrations/nusmods";

const DAY_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function hhmmToMinutes(hhmm: string) {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(2), 10);
  return h * 60 + m;
}

function getSingaporeNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 8 * 60 * 60_000);
}

function nextOccurrenceFrom(sgNow: Date, day: string, startTime: string) {
  const targetDow = DAY_TO_INDEX[day];
  if (targetDow === undefined) return null;

  const sgDow = sgNow.getDay();
  const startMin = hhmmToMinutes(startTime);
  const nowMin = sgNow.getHours() * 60 + sgNow.getMinutes();

  let deltaDays = (targetDow - sgDow + 7) % 7;
  if (deltaDays === 0 && startMin <= nowMin) deltaDays = 7;

  const d = new Date(sgNow);
  d.setDate(sgNow.getDate() + deltaDays);
  d.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  return d;
}

export async function POST(req: Request) {
  try {
    const { nusmodsShareLink, semester = 2, days = 7 } = await req.json();

    if (!nusmodsShareLink) {
      return NextResponse.json({ error: "Missing nusmodsShareLink" }, { status: 400 });
    }

    const modules = await getTimetableFromShareLink(nusmodsShareLink, semester);

    const sgNow = getSingaporeNow();
    const windowEnd = new Date(sgNow);
    windowEnd.setDate(sgNow.getDate() + Number(days));
    const windowEndMs = windowEnd.getTime();

    let best: any = null;

    for (const mod of modules) {
      for (const lesson of mod.lessons ?? []) {
        const startAt = nextOccurrenceFrom(sgNow, lesson.day, lesson.startTime);
        if (!startAt) continue;

        const startAtMs = startAt.getTime();
        if (startAtMs < sgNow.getTime() || startAtMs > windowEndMs) continue;

        const candidate = {
          moduleCode: mod.moduleCode,
          lessonType: lesson.lessonTypeFull,
          lessonTypeShort: lesson.lessonTypeShort,
          classNo: lesson.classNo,
          day: lesson.day,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          venue: lesson.venue,
          startAt: startAt.toISOString(),
          startAtMs,
        };

        if (!best || candidate.startAtMs < best.startAtMs) best = candidate;
      }
    }

    return NextResponse.json({ next: best });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
