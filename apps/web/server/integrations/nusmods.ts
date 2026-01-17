// Server-only helpers for NUSMods

export type NusmodsSelections = Array<{
  moduleCode: string;
  lessonTypeShort: string; // e.g. LEC/TUT/LAB
  classNo: string;         // e.g. "01"
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

    // Split into "LAB:(0)" parts
    const parts = value.split(";").map((s) => s.trim()).filter(Boolean);

    for (const part of parts) {
      // Match "TUT:(26)" or "LEC:(5,6)"
      const m = part.match(/^([A-Z]+):\(([^)]+)\)$/);
      if (!m) continue;

      const lessonTypeShort = m[1].trim();
      const classList = m[2]
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      for (const classNo of classList) {
        selections.push({
          moduleCode,
          lessonTypeShort,
          classNo,
        });
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
