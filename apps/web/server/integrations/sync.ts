// sync.ts - Combine NUSMods + Canvas into one JSON

import { getTimetableFromShareLink, ModuleWithLessonsAndWorkload, ResolvedLesson } from './nusmods';
import { fetchCanvasAssignments, CanvasAssignment } from './canvas';

export type LLMPlannerLesson = {
  lessonType: string;
  lessonCode: string;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  weeks: number[];
};

export type LLMPlannerModule = {
  moduleCode: string;
  title: string;
  totalWorkloadHours: number;
  lessons: LLMPlannerLesson[];
};

export type LLMPlanner = {
  modules: LLMPlannerModule[];
  assignments: CanvasAssignment[];
};

export async function getStudentPlanner(
  nusmodsLink: string,
  semester: number,
  canvasToken: string
): Promise<LLMPlanner> {
  const modulesRaw: ModuleWithLessonsAndWorkload[] = await getTimetableFromShareLink(nusmodsLink, semester);

  // Map to LLM-friendly structure
  const modules: LLMPlannerModule[] = modulesRaw.map(mod => ({
    moduleCode: mod.moduleCode,
    title: mod.title,
    totalWorkloadHours: mod.totalWorkloadHours,
    lessons: mod.lessons.map((l: ResolvedLesson) => ({
      lessonType: l.lessonTypeFull,
      lessonCode: `${l.lessonTypeShort}${l.classNo}`,
      day: l.day,
      startTime: l.startTime,
      endTime: l.endTime,
      venue: l.venue,
      weeks: l.weeks
    }))
  }));

  // Sort modules by workload descending
  modules.sort((a, b) => b.totalWorkloadHours - a.totalWorkloadHours);

  const assignments: CanvasAssignment[] = await fetchCanvasAssignments(canvasToken);

  return { modules, assignments };
}