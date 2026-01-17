// TypeScript types matching Python Pydantic schemas

export interface StudyTask {
  id?: number;
  title: string;
  course: string;
  dueAt: string; // ISO timestamp
  link?: string | null;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleEvent {
  id?: number;
  module: string;
  type: string; // LEC, TUT, LAB
  day: string; // Monday, Tuesday, etc.
  startTime: string; // e.g., "1400"
  endTime: string; // e.g., "1500"
  venue?: string | null;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatRequest {
  userId: string;
  message: string;
  useTTS?: boolean;
  canvasToken?: string;
  nusmodsShareLink?: string;
}

export interface ChatResponse {
  assistantMessage: string;
  audioUrl?: string | null;
}

export type RightNowType = "CLASS" | "TASK" | "IDLE";

export interface RightNowResponse {
  message: string;
  type: RightNowType;
  data?: {
    task?: StudyTask;
    event?: ScheduleEvent;
    hoursUntil?: number;
    minutesUntil?: number;
    daysUntil?: number;
    urgency?: "CRITICAL" | "URGENT" | "HIGH" | "NORMAL";
  };
}

export interface ScheduleClash {
  event1: ScheduleEvent;
  event2: ScheduleEvent;
  conflict: string;
}

export interface NextClassInfo {
  event: ScheduleEvent;
  timeUntil: string;
  formatted: string;
}

export interface ScheduleClashResponse {
  hasClash: boolean;
  clashes: ScheduleClash[];
  nextClass?: NextClassInfo | null;
  timeUntilNext?: string | null;
}

export interface DataStore {
  studyTasks: StudyTask[];
  scheduleEvents: ScheduleEvent[];
}
