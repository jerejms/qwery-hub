// nusmods.ts - Server-only NUSMods helpers

export type NusmodsSelections = Array<{
  moduleCode: string;
  lessonTypeShort: string; // "LEC", "TUT", "LAB"
  classNo: string;         // e.g., "01"
}>;

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
  lessonTypeShort: string;
  lessonTypeFull: string;
  classNo: string;
  day: string;
  startTime: string;
  endTime: string;
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

    const parts = value.split(";").map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      const m = part.match(/^([A-Z]+):\(([^)]+)\)$/);
      if (!m) continue;

      const lessonTypeShort = m[1].trim();
      const classList = m[2].split(",").map(x => x.trim()).filter(Boolean);

      for (const classNo of classList) selections.push({ moduleCode, lessonTypeShort, classNo });
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
  const res = await fetch(`https://api.nusmods.com/v2/${acadYear}/modules/${moduleCode}.json`, { cache: "no-store" });
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

// ======= Pick semester =======

export function pickSemester(moduleJson: any, semester: number) {
  const arr = moduleJson?.semesterData;
  if (!Array.isArray(arr)) return null;
  return arr.find((s: any) => s?.semester === semester) ?? null;
}

// ======= Resolve lessons =======

export function resolveLessonsFromModule(
  moduleCode: string,
  semesterData: any,
  selections: NusmodsSelections
): ResolvedLesson[] {
  if (!semesterData?.timetable) return [];
  return selections
    .filter(s => s.moduleCode === moduleCode)
    .flatMap(sel => {
      const fullType = LESSON_TYPE_MAP[sel.lessonTypeShort] ?? sel.lessonTypeShort;
      return semesterData.timetable
        .filter((l: any) => l.classNo === sel.classNo && l.lessonType === fullType)
        .map((l: any) => ({
          moduleCode,
          lessonTypeShort: sel.lessonTypeShort,
          lessonTypeFull: l.lessonType,
          classNo: l.classNo,
          day: l.day,
          startTime: l.startTime,
          endTime: l.endTime,
          venue: l.venue,
          weeks: l.weeks,
        }));
    });
}

// ======= Workload helpers =======

export function extractWorkload(moduleJson: any): ModuleWorkload {
  const raw = moduleJson.workload;
  if (!raw) return {};

  const workload: ModuleWorkload = { others: [] };

  // Ensure raw is an array
  const arr = Array.isArray(raw) ? raw : [raw];

  for (const entry of arr) {
    if (!entry) continue;
    const entryStr = String(entry); // convert number/other to string
    const lower = entryStr.toLowerCase();

    if (lower.includes("lecture")) workload.lecture = entryStr;
    else if (lower.includes("tutorial")) workload.tutorial = entryStr;
    else if (lower.includes("lab")) workload.lab = entryStr;
    else if (lower.includes("recitation")) workload.recitation = entryStr;
    else if (lower.includes("self study") || lower.includes("self-study")) workload.selfStudy = entryStr;
    else if (lower.includes("seminar")) workload.seminar = entryStr;
    else workload.others!.push(entryStr);
  }

  if (workload.others!.length === 0) delete workload.others;

  return workload;
}
export function parseWorkloadHours(workloadStr: string): number {
  const match = workloadStr.match(/(\d+)(?:-(\d+))?\s*hours/i);
  if (!match) return 0;
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  return (min + max) / 2;
}

export function calculateModuleWorkload(module: ModuleWithLessonsAndWorkload): number {
  let total = 0;
  const w = module.workload;
  if (!w) return 0;
  for (const key of ["lecture", "tutorial", "lab", "recitation", "selfStudy", "seminar"] as const) {
    if (w[key]) total += parseWorkloadHours(w[key]!);
  }
  if (w.others) for (const entry of w.others) total += parseWorkloadHours(entry);
  return total;
}

// ======= One-shot timetable + workload =======

export async function getTimetableFromShareLink(
  link: string,
  semester: number,
  acadYear = "2025-2026"
): Promise<ModuleWithLessonsAndWorkload[]> {
  const selections = parseNusmodsShareLink(link);
  const moduleCodes = extractModuleCodes(link);
  const result: ModuleWithLessonsAndWorkload[] = [];

  for (const code of moduleCodes) {
    const moduleJson = await fetchNusmodsModuleCached(code, acadYear);
    const sem = pickSemester(moduleJson, semester);
    if (!sem) continue;

    const lessons = resolveLessonsFromModule(code, sem, selections);
    const workload = extractWorkload(moduleJson);
    const totalWorkloadHours = calculateModuleWorkload({ moduleCode: code, title: moduleJson.title, lessons, workload, totalWorkloadHours: 0 });

    result.push({ moduleCode: code, title: moduleJson.title, lessons, workload, totalWorkloadHours });
  }

  return result;
}