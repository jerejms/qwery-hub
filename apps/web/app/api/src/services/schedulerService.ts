// Scheduler Service - Checks for timetable clashes and calculates time until next class
import { ScheduleEvent, ScheduleClash, NextClassInfo, ScheduleClashResponse } from '../types';
import { getUserSchedule } from './dataService';

/**
 * Parse HHMM format time string to minutes since midnight
 */
function parseTime(timeStr: string): number {
  try {
    if (timeStr.length === 4) {
      const hours = parseInt(timeStr.slice(0, 2), 10);
      const minutes = parseInt(timeStr.slice(2), 10);
      return hours * 60 + minutes;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Check if two time ranges overlap
 */
function checkOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Check for overlapping schedule events on the same day
 */
export async function checkScheduleClashes(userId: string): Promise<ScheduleClash[]> {
  const allEvents = await getUserSchedule(userId);
  
  const clashes: ScheduleClash[] = [];
  
  // Group events by day
  const eventsByDay: Record<string, ScheduleEvent[]> = {};
  for (const event of allEvents) {
    if (!eventsByDay[event.day]) {
      eventsByDay[event.day] = [];
    }
    eventsByDay[event.day].push(event);
  }
  
  // Check for overlaps within each day
  for (const [day, dayEvents] of Object.entries(eventsByDay)) {
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const event1 = dayEvents[i];
        const event2 = dayEvents[j];
        
        const start1 = parseTime(event1.startTime);
        const end1 = parseTime(event1.endTime);
        const start2 = parseTime(event2.startTime);
        const end2 = parseTime(event2.endTime);
        
        if (checkOverlap(start1, end1, start2, end2)) {
          clashes.push({
            event1,
            event2,
            conflict: `Overlapping time slots on ${day}: ${event1.startTime}-${event1.endTime} and ${event2.startTime}-${event2.endTime}`,
          });
        }
      }
    }
  }
  
  return clashes;
}

/**
 * Calculate time until the next upcoming class
 */
export async function getNextClassReminder(userId: string): Promise<NextClassInfo | null> {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  const currentTimeInt = parseTime(currentTimeStr);
  
  const allEvents = await getUserSchedule(userId);
  
  if (allEvents.length === 0) {
    return null;
  }
  
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentDayIdx = dayOrder.indexOf(currentDay) >= 0 ? dayOrder.indexOf(currentDay) : 0;
  
  // Find next event
  let nextEvent: ScheduleEvent | null = null;
  let minutesUntil: number | null = null;
  
  for (const event of allEvents) {
    const eventDayIdx = dayOrder.indexOf(event.day) >= 0 ? dayOrder.indexOf(event.day) : 99;
    const eventStartInt = parseTime(event.startTime);
    
    const daysUntilEvent = (eventDayIdx - currentDayIdx + 7) % 7;
    
    // Check if event is in the future
    if (daysUntilEvent > 0) {
      // Future day
      minutesUntil = daysUntilEvent * 24 * 60 + eventStartInt - currentTimeInt;
      nextEvent = event;
      break;
    } else if (daysUntilEvent === 0 && eventStartInt > currentTimeInt) {
      // Today, but after current time
      minutesUntil = eventStartInt - currentTimeInt;
      nextEvent = event;
      break;
    }
  }
  
  if (!nextEvent) {
    // Wrap around to next week
    const firstEvent = allEvents[0];
    const firstDayIdx = dayOrder.indexOf(firstEvent.day) >= 0 ? dayOrder.indexOf(firstEvent.day) : 0;
    let daysUntil = (7 - currentDayIdx + firstDayIdx) % 7;
    if (daysUntil === 0) {
      daysUntil = 7;
    }
    const firstStartInt = parseTime(firstEvent.startTime);
    minutesUntil = daysUntil * 24 * 60 + firstStartInt - currentTimeInt;
    nextEvent = firstEvent;
  }
  
  if (!nextEvent || minutesUntil === null) {
    return null;
  }
  
  // Format time until
  const hours = Math.floor(minutesUntil / 60);
  const minutes = minutesUntil % 60;
  const days = Math.floor(hours / 24);
  const hoursInDay = hours % 24;
  
  let timeUntilStr: string;
  if (days > 0) {
    timeUntilStr = `${days} days ${hoursInDay} hours`;
  } else if (hours > 0) {
    timeUntilStr = `${hours} hours ${minutes} minutes`;
  } else {
    timeUntilStr = `${minutes} minutes`;
  }
  
  // Format event start time
  const startTimeStr = nextEvent.startTime;
  const formattedTime = startTimeStr.length === 4 
    ? `${startTimeStr.slice(0, 2)}:${startTimeStr.slice(2)}` 
    : startTimeStr;
  
  const formattedMessage = `Your next class is ${nextEvent.module} ${nextEvent.type} at ${formattedTime} in ${nextEvent.venue || 'TBA'} starting in ${timeUntilStr}`;
  
  return {
    event: nextEvent,
    timeUntil: timeUntilStr,
    formatted: formattedMessage,
  };
}

/**
 * Get comprehensive schedule information including clashes and next class
 */
export async function getScheduleInfo(userId: string): Promise<ScheduleClashResponse> {
  const clashes = await checkScheduleClashes(userId);
  const nextClass = await getNextClassReminder(userId);
  
  return {
    hasClash: clashes.length > 0,
    clashes,
    nextClass: nextClass || null,
    timeUntilNext: nextClass?.timeUntil || null,
  };
}
