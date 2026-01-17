// nusmods.ts - Server-only NUSMods helpers

export type NusmodsSelections = Array<{
  moduleCode: string;
  lessonTypeShort: string; // "LEC", "TUT", "LAB"
  classNo: string;         // NOTE: in newer NUSMods share links this may be an INDEX, not actual classNo
}>;

export const LESSON_TYPE_MAP: Record<string, string> = {
  LEC: "Lecture",
  TUT: "Tutorial",
  LAB: "Laboratory",
  REC: "Recitation",
  SEM: "Seminar",
  SEC: "Sectional Teaching",
  WS: "Workshop",
};

export type ResolvedLesson = {
  moduleCode: string;
  lessonTypeShort: string; // LEC/TUT/LAB...
  lessonTypeFull: string;  // Lecture/Tutorial/...
  classNo: string;         // actual classNo from API (e.g. "01", "E30")
  day: string;
  startTime: string;       // HHMM
  endTime: string;         // HHMM
  venue: string;
  weeks: number[];
};

export type ModuleWorkload = {
  lecture?: string;
  tutorial?: string;
  lab?: string;
  recitation?: string;
  selfStudy?: string;
  seminar?: string;
  others?: string[];
};

export type ModuleWithLessonsAndWorkload = {
  moduleCode: string;
  title: string;
  lessons: ResolvedLesson[];
  workload: ModuleWorkload;
  totalWorkloadHours: number;
};

// ======= NUSMods link parsing =======

export function parseNusmodsShareLink(link: string): NusmodsSelections {
  const url = new URL(link);
  const selections: NusmodsSelections = [];

  for (const [moduleCodeRaw, valueRaw] of url.searchParams.entries()) {
    const moduleCode = moduleCodeRaw.trim();
    const value = valueRaw.trim();
    if (!moduleCode || !value) continue;

    // Example: "LAB:(0);LEC:(5,6)"
    const parts = value.split(";").map((s) => s.trim()).filter(Boolean);

    for (const part of parts) {
      const m = part.match(/^([A-Z]+):\(([^)]+)\)$/);
      if (!m) continue;

      const lessonTypeShort = m[1].trim().toUpperCase();
      const classList = m[2].split(",").map((x) => x.trim()).filter(Boolean);

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

// ======= Fetch module JSON =======

const moduleCache = new Map<string, any>();

export async function fetchNusmodsModule(moduleCode: string, acadYear = "2025-2026") {
  const res = await fetch(
    `https://api.nusmods.com/v2/${acadYear}/modules/${moduleCode}.json`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`NUSMods module not found: ${moduleCode}`);
  return res.json();
}

export async function fetchNusmodsModuleCached(moduleCode: string, acadYear = "2025-2026") {
  const key = `${acadYear}:${moduleCode}`;
  if (moduleCache.has(key)) return moduleCache.get(key);
  const json = await fetchNusmodsModule(moduleCode, acadYear);
  moduleCache.set(key, json);
  return json;
}

// ======= Semester picker =======

export function pickSemester(moduleJson: any, semester: number) {
  const arr = moduleJson?.semesterData;
  if (!Array.isArray(arr)) return null;
  return arr.find((s: any) => s?.semester === semester) ?? null;
}

// ======= Timetable resolver (NEW share link format compatible) =======

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

// New share links store INDICES into a flattened slot list per lessonType.
// Build a stable unique option list, then index into it.
function buildSlotOptions(timetable: LessonSlot[], lessonTypeShort: string): SlotOption[] {
  const lt = normalizeLessonTypeShort(lessonTypeShort);

  const candidates = timetable.filter((s) => lessonTypeToShortFromApi(s.lessonType) === lt);

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

  // If you ever find mismatch between NUSMods index and API order, uncomment:
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

  // New format uses indices like "0", "4", "10"
  const idx = Number(raw);
  if (Number.isFinite(idx)) return options[idx] ?? null;

  // Old format fallback: shareValue is classNo
  return options.find((o) => String(o.classNo) === raw) ?? null;
}

// ======= Workload helpers =======

export function extractWorkload(moduleJson: any): ModuleWorkload {
  const raw = moduleJson?.workload;
  if (!raw) return {};

  const workload: ModuleWorkload = { others: [] };

  const arr = Array.isArray(raw) ? raw : [raw];

  for (const entry of arr) {
    if (!entry) continue;
    const entryStr = String(entry);
    const lower = entryStr.toLowerCase();

    if (lower.includes("lecture")) workload.lecture = entryStr;
    else if (lower.includes("tutorial")) workload.tutorial = entryStr;
    else if (lower.includes("lab")) workload.lab = entryStr;
    else if (lower.includes("recitation")) workload.recitation = entryStr;
    else if (lower.includes("self study") || lower.includes("self-study")) workload.selfStudy = entryStr;
    else if (lower.includes("seminar")) workload.seminar = entryStr;
    else workload.others!.push(entryStr);
  }

  if (workload.others?.length === 0) delete workload.others;

  return workload;
}

export function parseWorkloadHours(workloadStr: string): number {
  const match = String(workloadStr).match(/(\d+)(?:-(\d+))?\s*hours/i);
  if (!match) return 0;
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  return (min + max) / 2;
}

export function calculateModuleWorkload(module: { workload?: ModuleWorkload }): number {
  const w = module.workload;
  if (!w) return 0;

  let total = 0;
  for (const key of ["lecture", "tutorial", "lab", "recitation", "selfStudy", "seminar"] as const) {
    if (w[key]) total += parseWorkloadHours(w[key]!);
  }
  if (w.others) for (const entry of w.others) total += parseWorkloadHours(entry);

  return total;
}

// ======= One-shot timetable + workload (SINGLE export) =======

export async function getTimetableFromShareLink(
  link: string,
  semester: number,
  acadYear = "2025-2026"
): Promise<ModuleWithLessonsAndWorkload[]> {
  const selections = parseNusmodsShareLink(link);
  const moduleCodes = [...new Set(selections.map((s) => s.moduleCode))];

  const moduleJsons = await Promise.all(
    moduleCodes.map((code) => fetchNusmodsModuleCached(code, acadYear))
  );

  const out: ModuleWithLessonsAndWorkload[] = [];

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

    lessons.sort((a, b) => {
      const d = dayIndex(a.day) - dayIndex(b.day);
      if (d !== 0) return d;
      const t = a.startTime.localeCompare(b.startTime);
      if (t !== 0) return t;
      return a.moduleCode.localeCompare(b.moduleCode);
    });

    const workload = extractWorkload(modJson);
    const totalWorkloadHours = calculateModuleWorkload({ workload });

    out.push({
      moduleCode,
      title: String(modJson?.title ?? moduleCode),
      lessons,
      workload,
      totalWorkloadHours,
    });
  }

  return out;
}
