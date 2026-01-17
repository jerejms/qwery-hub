// Data Service - Reads from JSON file instead of database
import fs from 'fs/promises';
import path from 'path';
import { DataStore, StudyTask, ScheduleEvent } from '../types';
import { settings } from '../config/settings';

let dataCache: DataStore | null = null;

/**
 * Load data from JSON file
 */
export async function loadData(): Promise<DataStore> {
  if (dataCache) {
    return dataCache;
  }

  try {
    const dataPath = path.resolve(settings.DATA_FILE_PATH || './data.json');
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    const data: DataStore = JSON.parse(fileContent);
    
    // Ensure arrays exist
    if (!data.studyTasks) data.studyTasks = [];
    if (!data.scheduleEvents) data.scheduleEvents = [];
    
    dataCache = data;
    return data;
  } catch (error) {
    console.error('Error loading data file:', error);
    // Return empty data structure if file doesn't exist
    return {
      studyTasks: [],
      scheduleEvents: [],
    };
  }
}

/**
 * Get all tasks for a user, ordered by due date
 */
export async function getUserTasks(userId: string, limit: number = 20): Promise<StudyTask[]> {
  const data = await loadData();
  
  return data.studyTasks
    .filter(task => task.userId === userId)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit);
}

/**
 * Get schedule events for a user, optionally filtered by day
 */
export async function getUserSchedule(userId: string, day?: string): Promise<ScheduleEvent[]> {
  const data = await loadData();
  
  let events = data.scheduleEvents.filter(event => event.userId === userId);
  
  if (day) {
    events = events.filter(event => event.day === day);
  }
  
  // Sort by day and start time
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return events.sort((a, b) => {
    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Reload data from file (useful if data is updated externally)
 */
export async function reloadData(): Promise<void> {
  dataCache = null;
  await loadData();
}
