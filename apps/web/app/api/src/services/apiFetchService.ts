// API Fetch Service - Fetches data from Canvas and NUSMods APIs
import { fetchCanvasTodo } from '@/server/integrations/canvas';
import { getTimetableFromShareLink } from '@/server/integrations/nusmods';
import { StudyTask, ScheduleEvent } from '../types';

/**
 * Fetch tasks from Canvas API
 */
export async function fetchCanvasTasks(canvasToken: string): Promise<StudyTask[]> {
  if (!canvasToken) {
    return [];
  }

  try {
    const canvasData = await fetchCanvasTodo(canvasToken);

    // Transform Canvas API response to StudyTask format
    if (!Array.isArray(canvasData)) {
      return [];
    }

    return canvasData.map((item: any) => ({
      title: item.assignment?.name || item.title || 'Untitled Task',
      course: item.course?.name || item.context_name || 'Unknown Course',
      dueAt: item.assignment?.due_at || item.due_at || new Date().toISOString(),
      link: item.assignment?.html_url || item.html_url || null,
    }));
  } catch (error) {
    console.error('Error fetching Canvas tasks:', error);
    return [];
  }
}

/**
 * Fetch workload data from NUSMods API
 * Returns a map of module code -> totalWorkloadHours
 */
export async function fetchNusModsWorkloads(
  nusmodsShareLink: string,
  semester: number = 2
): Promise<Record<string, number>> {
  if (!nusmodsShareLink) {
    return {};
  }

  try {
    const acadYear = '2025-2026'; // Could be made configurable
    
    // Use getTimetableFromShareLink which already calculates workloads
    const modules = await getTimetableFromShareLink(nusmodsShareLink, semester, acadYear);

    const workloads: Record<string, number> = {};
    for (const module of modules) {
      workloads[module.moduleCode] = module.totalWorkloadHours;
    }

    return workloads;
  } catch (error) {
    console.error('Error fetching NUSMods workloads:', error);
    return {};
  }
}

/**
 * Fetch schedule from NUSMods API
 * Uses getTimetableFromShareLink which correctly handles index-based class selection
 */
export async function fetchNusModsSchedule(
  nusmodsShareLink: string,
  userId: string,
  semester: number = 2
): Promise<ScheduleEvent[]> {
  if (!nusmodsShareLink) {
    return [];
  }

  try {
    const acadYear = '2025-2026'; // Could be made configurable
    
    // Use getTimetableFromShareLink which properly resolves class indices
    const modules = await getTimetableFromShareLink(nusmodsShareLink, semester, acadYear);

    const scheduleEvents: ScheduleEvent[] = [];

    for (const module of modules) {
      for (const lesson of module.lessons) {
        scheduleEvents.push({
          module: module.moduleCode,
          type: lesson.lessonTypeShort,
          day: lesson.day,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          venue: lesson.venue || null,
          userId,
        });
      }
    }

    return scheduleEvents;
  } catch (error) {
    console.error('Error fetching NUSMods schedule:', error);
    return [];
  }
}
