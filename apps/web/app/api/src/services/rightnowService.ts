// RightNow Service - Prioritizes Canvas assignments by due date urgency
import { StudyTask, ScheduleEvent, RightNowResponse } from '../types';
import { getUserTasks, getUserSchedule } from './dataService';

/**
 * Get the most urgent task or upcoming class suggestion.
 * Prioritizes Canvas assignments by due date (nearest first).
 */
export async function getRightNowSuggestion(userId: string): Promise<RightNowResponse> {
  const now = new Date();
  
  // Get all user tasks, ordered by due date
  const allTasks = await getUserTasks(userId, 100); // Get more tasks to filter
  
  // Filter to upcoming tasks (dueAt >= now)
  const upcomingTasks: Array<{ task: StudyTask; dueDate: Date }> = [];
  
  for (const task of allTasks) {
    try {
      const dueDate = new Date(task.dueAt);
      if (dueDate >= now) {
        upcomingTasks.push({ task, dueDate });
      }
    } catch (error) {
      // Skip tasks with invalid date format
      continue;
    }
  }
  
  // Sort by urgency (nearest due first)
  if (upcomingTasks.length > 0) {
    upcomingTasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const { task: mostUrgentTask, dueDate } = upcomingTasks[0];
    
    // Calculate time until due
    const timeUntilDue = dueDate.getTime() - now.getTime();
    const hoursUntil = timeUntilDue / (1000 * 60 * 60);
    
    // Format message based on urgency
    let urgency: "CRITICAL" | "URGENT" | "HIGH" | "NORMAL";
    if (hoursUntil < 2) {
      urgency = "CRITICAL";
    } else if (hoursUntil < 24) {
      urgency = "URGENT";
    } else if (hoursUntil < 48) {
      urgency = "HIGH";
    } else {
      urgency = "NORMAL";
    }
    
    let timeStr: string;
    if (hoursUntil < 1) {
      timeStr = `${Math.floor(timeUntilDue / (1000 * 60))} minutes`;
    } else if (hoursUntil < 24) {
      timeStr = `${Math.floor(hoursUntil)} hours`;
    } else {
      const days = Math.floor(hoursUntil / 24);
      timeStr = `${days} days`;
    }
    
    const message = `Focus on ${mostUrgentTask.course} - ${mostUrgentTask.title} | Due in ${timeStr} (${urgency})`;
    
    return {
      type: "TASK",
      message,
      data: {
        task: mostUrgentTask,
        hoursUntil: Math.round(hoursUntil * 100) / 100,
        urgency,
      },
    };
  }
  
  // No urgent tasks - check if class starting soon (within 60 min)
  const allEvents = await getUserSchedule(userId);
  
  // Get current day of week
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  const currentTimeInt = parseInt(currentTimeStr, 10);
  
  // Check events for today or next few days
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentDayIdx = dayOrder.indexOf(currentDay) >= 0 ? dayOrder.indexOf(currentDay) : 0;
  
  for (const event of allEvents) {
    const eventDayIdx = dayOrder.indexOf(event.day) >= 0 ? dayOrder.indexOf(event.day) : 99;
    
    // Check if event is today or in the future
    const daysUntilEvent = (eventDayIdx - currentDayIdx + 7) % 7;
    
    if (daysUntilEvent === 0) {
      // Today
      try {
        const eventStartInt = parseInt(event.startTime, 10);
        const timeDiff = eventStartInt - currentTimeInt;
        // Convert to minutes
        const hours = Math.floor(timeDiff / 100);
        const minutes = timeDiff % 100;
        const minutesUntil = hours * 60 + minutes;
        
        if (minutesUntil >= 0 && minutesUntil <= 60) {
          const startTimeFormatted = event.startTime.length === 4 
            ? `${event.startTime.slice(0, 2)}:${event.startTime.slice(2)}` 
            : event.startTime;
          const message = `You have ${event.module} ${event.type} starting at ${startTimeFormatted} in ${minutesUntil} minutes`;
          return {
            type: "CLASS",
            message,
            data: {
              event,
              minutesUntil,
            },
          };
        }
      } catch (error) {
        continue;
      }
    } else if (daysUntilEvent > 0 && daysUntilEvent <= 1) {
      // Tomorrow or next day
      try {
        const eventStartInt = parseInt(event.startTime, 10);
        if (eventStartInt <= 1400) {
          // Before 2 PM
          const startTimeFormatted = event.startTime.length === 4 
            ? `${event.startTime.slice(0, 2)}:${event.startTime.slice(2)}` 
            : event.startTime;
          const message = `You have ${event.module} ${event.type} tomorrow at ${startTimeFormatted}`;
          return {
            type: "CLASS",
            message,
            data: {
              event,
              daysUntil: daysUntilEvent,
            },
          };
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  // No urgent tasks or upcoming classes
  return {
    type: "IDLE",
    message: "No urgent tasks. You can work ahead!",
  };
}
