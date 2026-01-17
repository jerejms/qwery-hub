// RAG Service - Retrieves and formats data from JSON file for LLM context
import { StudyTask, ScheduleEvent } from '../types';
import { getUserTasks, getUserSchedule } from './dataService';

/**
 * Format database data into structured text for LLM system prompt
 */
export async function formatContextForLLM(
  tasks: StudyTask[],
  events: ScheduleEvent[],
  currentTime: Date,
  moduleWorkloads?: Record<string, number>
): Promise<string> {
  const contextLines: string[] = [];

  // Format current time
  contextLines.push(`Current Time: ${currentTime.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
  contextLines.push('');

  // Format tasks section
  contextLines.push("=== USER'S STUDY TASKS (from Canvas) ===");
  if (tasks.length > 0) {
    for (const task of tasks) {
      // Try to match course name to module code for workload lookup
      // Simple exact match: course name === module code
      const workload = moduleWorkloads?.[task.course];
      const workloadStr = workload !== undefined ? ` | Workload: ${workload} hours/week` : '';

      contextLines.push(
        `- Task: ${task.title} | Course: ${task.course} | Due: ${task.dueAt}${workloadStr}`
      );
    }
  } else {
    contextLines.push('- No tasks found.');
  }
  contextLines.push('');

  // Format schedule section
  contextLines.push("=== USER'S CLASS SCHEDULE (from NUSMods) ===");
  if (events.length > 0) {
    // Filter out past events on the current day
    const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInt = currentHour * 60 + currentMinute;
    
    const upcomingEvents = events.filter(event => {
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const currentDayIdx = dayOrder.indexOf(currentDay) >= 0 ? dayOrder.indexOf(currentDay) : 0;
      const eventDayIdx = dayOrder.indexOf(event.day) >= 0 ? dayOrder.indexOf(event.day) : 99;
      
      // Parse event start time (HHMM format)
      const eventStartInt = event.startTime.length === 4
        ? parseInt(event.startTime.slice(0, 2), 10) * 60 + parseInt(event.startTime.slice(2), 10)
        : 0;
      
      const daysUntilEvent = (eventDayIdx - currentDayIdx + 7) % 7;
      
      // Keep future days or today's events that haven't started yet
      return daysUntilEvent > 0 || (daysUntilEvent === 0 && eventStartInt > currentTimeInt);
    });

    if (upcomingEvents.length === 0) {
      contextLines.push('- No upcoming classes found.');
    } else {
      // Group by day
      const eventsByDay: Record<string, ScheduleEvent[]> = {};
      for (const event of upcomingEvents) {
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
        // Sort events by start time within each day (chronologically)
        dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));
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
