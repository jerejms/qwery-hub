import { NextResponse } from "next/server";
import {
  parseNusmodsShareLink,
  fetchNusmodsModule,
  pickSemester,
} from "@/server/integrations/nusmods";

const DAY_TO_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

const SHORT_TO_FULL: Record<string, string> = {
  LEC: "Lecture",
  TUT: "Tutorial",
  LAB: "Laboratory",
  REC: "Recitation",
  SEM: "Seminar",
  SEC: "Sectional Teaching",
};

// Convert "1400" -> minutes since midnight
function hhmmToMinutes(hhmm: string) {
  const h = parseInt(hhmm.slice(0, 2), 10);
  const m = parseInt(hhmm.slice(2), 10);
  return h * 60 + m;
}

// Get next occurrence Date for a given weekday + time (in Singapore local time)
function nextOccurrence(day: string, startTime: string) {
  const now = new Date();
  // Singapore time: easiest hackathon approach:
  const sgNow = new Date(now.toLocaleString("en-SG", { timeZone: "Asia/Singapore" }));
  const targetDow = DAY_TO_INDEX[day];
  if (targetDow === undefined) return null;

  const sgDow = sgNow.getDay();
  const startMin = hhmmToMinutes(startTime);
  const nowMin = sgNow.getHours() * 60 + sgNow.getMinutes();

  let deltaDays = (targetDow - sgDow + 7) % 7;
  if (deltaDays === 0 && startMin <= nowMin) deltaDays = 7; // if today but already passed, go next week

  const d = new Date(sgNow);
  d.setDate(sgNow.getDate() + deltaDays);
  d.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  return d;
}

export async function POST(req: Request) {
  const { nusmodsShareLink, semester = 2 } = await req.json();

  if (!nusmodsShareLink) {
    return NextResponse.json({ error: "Missing nusmodsShareLink" }, { status: 400 });
  }

  const selections = parseNusmodsShareLink(nusmodsShareLink);

  // Fetch all module JSON in parallel
  const moduleCodes = [...new Set(selections.map((s) => s.moduleCode))];
  const modules = await Promise.all(moduleCodes.map((c) => fetchNusmodsModule(c)));

  // Build candidate lessons from selected class slots only
  const candidates: any[] = [];

  for (const sel of selections) {
    const modJson = modules.find((m: any) => m.moduleCode === sel.moduleCode) ?? null;
    if (!modJson) continue;

    const sem = pickSemester(modJson, semester);
    const tt = sem?.timetable;
    if (!Array.isArray(tt)) continue;

    for (const slot of tt) {
      // Match selected class
      if (slot.lessonType !== sel.lessonTypeShort) continue;
      if (String(slot.classNo) !== String(sel.classNo)) continue;

      const startAt = nextOccurrence(slot.day, slot.startTime);
      if (!startAt) continue;

      candidates.push({
        moduleCode: sel.moduleCode,
        lessonType: slot.lessonType,
        classNo: slot.classNo,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        venue: slot.venue ?? null,
        startAt: startAt.toISOString(),
        startAtMs: startAt.getTime(),
      });
    }
  }

  candidates.sort((a, b) => a.startAtMs - b.startAtMs);

  const next = candidates[0] ?? null;
  return NextResponse.json({ next });
}
