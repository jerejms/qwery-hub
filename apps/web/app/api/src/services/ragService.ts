// RAG Service - Retrieves and formats data from JSON file for LLM context
import { StudyTask, ScheduleEvent } from '../types';
import { getUserTasks, getUserSchedule } from './dataService';

/**
 * Format database data into structured text for LLM system prompt
 */
export async function formatContextForLLM(
  tasks: StudyTask[],
  events: ScheduleEvent[],
  currentTime: Date
): Promise<string> {
  const contextLines: string[] = [];
  
  // Format current time
  contextLines.push(`Current Time: ${currentTime.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
  contextLines.push('');
  
  // Format tasks section
  contextLines.push("=== USER'S STUDY TASKS (from Canvas) ===");
  if (tasks.length > 0) {
    for (const task of tasks) {
      contextLines.push(
        `- Task: ${task.title} | Course: ${task.course} | Due: ${task.dueAt} | Link: ${task.link || 'N/A'}`
      );
    }
  } else {
    contextLines.push('- No tasks found.');
  }
  contextLines.push('');
  
  // Format schedule section
  contextLines.push("=== USER'S CLASS SCHEDULE (from NUSMods) ===");
  if (events.length > 0) {
    // Group by day
    const eventsByDay: Record<string, ScheduleEvent[]> = {};
    for (const event of events) {
      if (!eventsByDay[event.day]) {
        eventsByDay[event.day] = [];
      }
      eventsByDay[event.day].push(event);
    }
    
    // Sort days
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedDays = Object.keys(eventsByDay).sort(
      (a, b) => (dayOrder.indexOf(a) >= 0 ? dayOrder.indexOf(a) : 99) - 
                (dayOrder.indexOf(b) >= 0 ? dayOrder.indexOf(b) : 99)
    );
    
    for (const day of sortedDays) {
      const dayEvents = eventsByDay[day];
      contextLines.push(`\n${day}:`);
      for (const event of dayEvents) {
        const startTime = event.startTime.length === 4 
          ? `${event.startTime.slice(0, 2)}:${event.startTime.slice(2)}` 
          : event.startTime;
        const endTime = event.endTime.length === 4 
          ? `${event.endTime.slice(0, 2)}:${event.endTime.slice(2)}` 
          : event.endTime;
        contextLines.push(
          `  - ${event.module} (${event.type}) | ${startTime}-${endTime} | Venue: ${event.venue || 'N/A'}`
        );
      }
    }
  } else {
    contextLines.push('- No schedule events found.');
  }
  
  return contextLines.join('\n');
}

/**
 * Get user tasks and format context for LLM
 */
export async function getRAGContext(userId: string): Promise<string> {
  const tasks = await getUserTasks(userId);
  const events = await getUserSchedule(userId);
  const currentTime = new Date();
  
  return formatContextForLLM(tasks, events, currentTime);
}
