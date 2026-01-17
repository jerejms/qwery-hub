// Server-only helpers for NUSMods

export type NusmodsSelections = Array<{
  moduleCode: string;
  lessonTypeShort: string; // e.g. LEC/TUT/LAB
  classNo: string;         // share link value, e.g. "4" (index) or sometimes "01" (older)
}>;

export function parseNusmodsShareLink(link: string): NusmodsSelections {
  const url = new URL(link);
  const selections: NusmodsSelections = [];

  // Newer NUSMods format:
  // CS2040C = "LAB:(0);LEC:(5,6)"
  // CDE2501 = "TUT:(26);LEC:(32)"
  for (const [moduleCodeRaw, valueRaw] of url.searchParams.entries()) {
    const moduleCode = moduleCodeRaw.trim();
    const value = valueRaw.trim();
    if (!moduleCode || !value) continue;

    const parts = value.split(";").map((s) => s.trim()).filter(Boolean);

    for (const part of parts) {
      const m = part.match(/^([A-Z]+):\(([^)]+)\)$/);
      if (!m) continue;

      const lessonTypeShort = m[1].trim();
      const classList = m[2]
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      for (const classNo of classList) {
        selections.push({ moduleCode, lessonTypeShort, classNo });
      }
    }
  }

  return selections;
}

export function extractModuleCodes(link: string): string[] {
  const url = new URL(link);
  const set = new Set<string>();

  for (const key of url.searchParams.keys()) {
    const code = key.split("[")[0]?.trim();
    if (code) set.add(code);
  }

  return [...set].sort();
}

// Optional: map abbreviations to NUSMods lessonType strings
export const LESSON_TYPE_MAP: Record<string, string> = {
  LEC: "Lecture",
  TUT: "Tutorial",
  LAB: "Laboratory",
  REC: "Recitation",
  SEM: "Seminar",
  SEC: "Sectional Teaching",
};

export type ResolvedLesson = {
  moduleCode: string;
  lessonTypeShort: string; // LEC/TUT/LAB
  lessonTypeFull: string;  // Lecture/Tutorial/...
  classNo: string;         // classNo from NUSMods API (e.g. "01", "E30", etc)
  day: string;
  startTime: string;       // HHMM
  endTime: string;         // HHMM
  venue: string;
  weeks: number[];
};

export type ModuleWithLessons = {
  moduleCode: string;
  title?: string;
  lessons: ResolvedLesson[];
};

const DAY_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function dayIndex(day: string) {
  return DAY_TO_INDEX[String(day)] ?? 99;
}

function normalizeLessonTypeShort(s: string) {
  return String(s).trim().toUpperCase();
}

function lessonTypeToShortFromApi(lessonType: string) {
  const s = String(lessonType).toLowerCase();
  if (s === "lecture") return "LEC";
  if (s === "tutorial") return "TUT";
  if (s === "laboratory") return "LAB";
  if (s === "sectional teaching") return "SEC";
  if (s === "recitation") return "REC";
  if (s === "workshop") return "WS";
  if (s === "seminar") return "SEM";
  if (s === "seminar-style module class") return "SEM";
  return String(lessonType).slice(0, 3).toUpperCase();
}

type LessonSlot = {
  lessonType: string;
  classNo: string;
  day: string;
  startTime: string;
  endTime: string;
  venue?: string;
  weeks?: number[];
};

type SlotOption = LessonSlot & { _key: string };

// IMPORTANT:
// New NUSMods share links store indices into a flattened slot list (not just classNo groups).
// So we build a stable list of unique slots for that lessonType and index into it.
function buildSlotOptions(timetable: LessonSlot[], lessonTypeShort: string): SlotOption[] {
  const lt = normalizeLessonTypeShort(lessonTypeShort);

  const candidates = timetable.filter(
    (s) => lessonTypeToShortFromApi(s.lessonType) === lt
  );

  const seen = new Set<string>();
  const out: SlotOption[] = [];

  for (const s of candidates) {
    const key = [
      lt,
      String(s.classNo),
      String(s.day),
      String(s.startTime),
      String(s.endTime),
      String(s.venue ?? ""),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ ...s, _key: key });
  }

  // If API encounter order mismatches NUSMods indices, enable this sort:
  // out.sort((a, b) => {
  //   const d = dayIndex(a.day) - dayIndex(b.day);
  //   if (d !== 0) return d;
  //   const t = String(a.startTime).localeCompare(String(b.startTime));
  //   if (t !== 0) return t;
  //   const e = String(a.endTime).localeCompare(String(b.endTime));
  //   if (e !== 0) return e;
  //   const v = String(a.venue ?? "").localeCompare(String(b.venue ?? ""));
  //   if (v !== 0) return v;
  //   return String(a.classNo).localeCompare(String(b.classNo), undefined, { numeric: true });
  // });

  return out;
}

function resolveIndexToSlot(options: SlotOption[], shareValue: string): SlotOption | null {
  const raw = String(shareValue).trim();

  // New share link values are indices like "4", "10", etc
  const idx = Number(raw);
  if (Number.isFinite(idx)) return options[idx] ?? null;

  // Fallback: older formats might directly include classNo.
  // In that case, pick the first slot whose classNo matches.
  return options.find((o) => String(o.classNo) === raw) ?? null;
}

export async function getTimetableFromShareLink(
  link: string,
  semester: number,
  acadYear = "2025-2026"
): Promise<ModuleWithLessons[]> {
  const selections = parseNusmodsShareLink(link);
  const moduleCodes = [...new Set(selections.map((s) => s.moduleCode))];

  const moduleJsons = await Promise.all(
    moduleCodes.map((code) => fetchNusmodsModule(code, acadYear))
  );

  const out: ModuleWithLessons[] = [];

  for (const modJson of moduleJsons) {
    const moduleCode = String(modJson?.moduleCode ?? "").trim();
    if (!moduleCode) continue;

    const sem = pickSemester(modJson, semester);
    const timetable: LessonSlot[] = Array.isArray(sem?.timetable) ? sem.timetable : [];

    const mySel = selections.filter((s) => s.moduleCode === moduleCode);

    const lessons: ResolvedLesson[] = [];
    const seen = new Set<string>();

    for (const sel of mySel) {
      const lt = normalizeLessonTypeShort(sel.lessonTypeShort);

      const options = buildSlotOptions(timetable, lt);
      if (!options.length) continue;

      const chosenSlot = resolveIndexToSlot(options, sel.classNo);
      if (!chosenSlot) continue;

      // Debug for your EE2111A case
      if (moduleCode === "EE2111A" && lt === "LAB") {
        console.log("[EE2111A LAB] options length =", options.length);
        console.log(
          `[EE2111A LAB] share value ${sel.classNo} ->`,
          chosenSlot && {
            classNo: chosenSlot.classNo,
            day: chosenSlot.day,
            start: chosenSlot.startTime,
            end: chosenSlot.endTime,
            venue: chosenSlot.venue ?? "",
          }
        );
      }

      const lessonTypeFull = LESSON_TYPE_MAP[lt] ?? chosenSlot.lessonType ?? lt;

      const key = [
        moduleCode,
        lt,
        String(chosenSlot.classNo),
        chosenSlot.day,
        chosenSlot.startTime,
        chosenSlot.endTime,
        chosenSlot.venue ?? "",
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);

      lessons.push({
        moduleCode,
        lessonTypeShort: lt,
        lessonTypeFull,
        classNo: String(chosenSlot.classNo),
        day: String(chosenSlot.day),
        startTime: String(chosenSlot.startTime),
        endTime: String(chosenSlot.endTime),
        venue: String(chosenSlot.venue ?? ""),
        weeks: Array.isArray(chosenSlot.weeks) ? chosenSlot.weeks : [],
      });
    }

    // Optional: stable sort lessons for nicer UI output
    lessons.sort((a, b) => {
      const d = dayIndex(a.day) - dayIndex(b.day);
      if (d !== 0) return d;
      const t = a.startTime.localeCompare(b.startTime);
      if (t !== 0) return t;
      return a.moduleCode.localeCompare(b.moduleCode);
    });

    out.push({ moduleCode, title: modJson?.title, lessons });
  }

  return out;
}

// Fetch module JSON from NUSMods
export async function fetchNusmodsModule(
  moduleCode: string,
  acadYear = "2025-2026"
) {
  const res = await fetch(
    `https://api.nusmods.com/v2/${acadYear}/modules/${moduleCode}.json`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error(`NUSMods module not found: ${moduleCode}`);
  return res.json();
}

// Pick a semester block from the module JSON
export function pickSemester(moduleJson: any, semester: number) {
  const arr = moduleJson?.semesterData;
  if (!Array.isArray(arr)) return null;
  return arr.find((s) => s?.semester === semester) ?? null;
}
