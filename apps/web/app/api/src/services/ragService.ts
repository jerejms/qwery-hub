// RAG Service - Retrieves and formats data from JSON file for LLM context
import { StudyTask, ScheduleEvent } from "../types";
import { getUserTasks, getUserSchedule } from "./dataService";

import { getSingaporeNow, DAY_TO_INDEX, minutesFromHHMM } from "@/lib/time";

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

  // Always compute "now" in Singapore for schedule reasoning
  const sgNow = getSingaporeNow(currentTime);

  // Format current time (show both for debugging clarity)
  contextLines.push(
    `Current Time (UTC): ${currentTime.toISOString().replace("T", " ").slice(0, 19)}`
  );
  contextLines.push(
    `Current Time (Singapore, +08:00): ${sgNow.toISOString().replace("T", " ").slice(0, 19)}`
  );
  contextLines.push("");

  // Format tasks section
  contextLines.push("=== USER'S STUDY TASKS (from Canvas) ===");
  if (tasks.length > 0) {
    for (const task of tasks) {
      // Try to match course name to module code for workload lookup
      // Simple exact match: course name === module code
      const workload = moduleWorkloads?.[task.course];
      const workloadStr =
        workload !== undefined ? ` | Workload: ${workload} hours/week` : "";

      contextLines.push(
        `- Task: ${task.title} | Course: ${task.course} | Due: ${task.dueAt}${workloadStr}`
      );
    }
  } else {
    contextLines.push("- No tasks found.");
  }
  contextLines.push("");

  // Format schedule section
  contextLines.push("=== USER'S CLASS SCHEDULE (from NUSMods) ===");
  if (events.length > 0) {
    // Use Singapore time for "current day" and "current minutes"
    const sgDayIdx = sgNow.getDay(); // 0=Sun ... 6=Sat
    const sgNowMin = sgNow.getHours() * 60 + sgNow.getMinutes();

    const upcomingEvents = events.filter((event) => {
      const eventDayIdx = DAY_TO_INDEX[event.day];
      if (eventDayIdx === undefined) return false;

      const eventStartMin = minutesFromHHMM(event.startTime);

      // How many days until the event occurs (0..6)
      let deltaDays = (eventDayIdx - sgDayIdx + 7) % 7;

      // If it's today but already started (or starting now), skip it
      if (deltaDays === 0 && eventStartMin <= sgNowMin) return false;

      return true;
    });

    if (upcomingEvents.length === 0) {
      contextLines.push("- No upcoming classes found.");
    } else {
      // Group by day
      const eventsByDay: Record<string, ScheduleEvent[]> = {};
      for (const event of upcomingEvents) {
        (eventsByDay[event.day] ??= []).push(event);
      }

      // Sort days relative to "today in Singapore"
      const sortedDays = Object.keys(eventsByDay).sort((a, b) => {
        const aIdx = DAY_TO_INDEX[a];
        const bIdx = DAY_TO_INDEX[b];
        const aDelta =
          aIdx === undefined ? 999 : (aIdx - sgDayIdx + 7) % 7;
        const bDelta =
          bIdx === undefined ? 999 : (bIdx - sgDayIdx + 7) % 7;
        return aDelta - bDelta;
      });

      for (const day of sortedDays) {
        const dayEvents = eventsByDay[day];

        // Sort events by start time within each day
        dayEvents.sort(
          (x, y) => minutesFromHHMM(x.startTime) - minutesFromHHMM(y.startTime)
        );

        contextLines.push(`\n${day}:`);
        for (const event of dayEvents) {
          const startTime =
            event.startTime.length === 4
              ? `${event.startTime.slice(0, 2)}:${event.startTime.slice(2)}`
              : event.startTime;
          const endTime =
            event.endTime.length === 4
              ? `${event.endTime.slice(0, 2)}:${event.endTime.slice(2)}`
              : event.endTime;

          contextLines.push(
            `  - ${event.module} (${event.type}) | ${startTime}-${endTime} | Venue: ${
              event.venue || "N/A"
            }`
          );
        }
      }
    }
  } else {
    contextLines.push("- No schedule events found.");
  }

  return contextLines.join("\n");
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
