// API Fetch Service - Fetches data from Canvas and NUSMods APIs
import { fetchCanvasTodo } from '@/server/integrations/canvas';
import { fetchNusmodsModule, parseNusmodsShareLink, extractModuleCodes } from '@/server/integrations/nusmods';
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
 * Fetch schedule from NUSMods API
 */
export async function fetchNusModsSchedule(
  nusmodsShareLink: string,
  userId: string
): Promise<ScheduleEvent[]> {
  if (!nusmodsShareLink) {
    return [];
  }

  try {
    const moduleCodes = extractModuleCodes(nusmodsShareLink);
    const selections = parseNusmodsShareLink(nusmodsShareLink);
    
    const scheduleEvents: ScheduleEvent[] = [];
    const acadYear = '2025-2026'; // Could be made configurable
    
    for (const moduleCode of moduleCodes) {
      try {
        const moduleData = await fetchNusmodsModule(moduleCode, acadYear);
        const semesterData = moduleData.semesterData?.[0]; // Use first semester
        
        if (!semesterData?.timetable) {
          continue;
        }
        
        // Filter to selected classes only
        const relevantSelections = selections.filter(s => s.moduleCode === moduleCode);
        
        for (const classItem of semesterData.timetable) {
          // Map lessonType to short form (e.g., "Lecture" -> "LEC")
          const lessonTypeMap: Record<string, string> = {
            'Lecture': 'LEC',
            'Tutorial': 'TUT',
            'Laboratory': 'LAB',
            'Recitation': 'REC',
            'Seminar': 'SEM',
            'Sectional Teaching': 'SEC',
          };
          
          const lessonTypeShort = lessonTypeMap[classItem.lessonType] || classItem.lessonType || 'LEC';
          const classNo = classItem.classNo?.toString() || '';
          
          // Check if this class is in the user's selections
          const isSelected = relevantSelections.length === 0 || relevantSelections.some(
            sel => sel.lessonTypeShort === lessonTypeShort && 
                   sel.classNo === classNo
          );
          
          if (isSelected) {
            // Format time from "HHMM" to "HHMM" (ensure 4 digits)
            const formatTime = (time: string): string => {
              if (!time) return '0900';
              // Remove colons if present (e.g., "09:00" -> "0900")
              const cleaned = time.replace(':', '');
              return cleaned.length === 4 ? cleaned : cleaned.padStart(4, '0');
            };
            
            scheduleEvents.push({
              module: moduleCode,
              type: lessonTypeShort,
              day: classItem.day || 'Monday',
              startTime: formatTime(classItem.startTime || '0900'),
              endTime: formatTime(classItem.endTime || '1000'),
              venue: classItem.venue || null,
              userId,
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching module ${moduleCode}:`, error);
        continue;
      }
    }
    
    return scheduleEvents;
  } catch (error) {
    console.error('Error fetching NUSMods schedule:', error);
    return [];
  }
}
