import { NextResponse } from "next/server";
import { analyzeQuestionIntent } from "@/app/api/src/services/questionAnalysisService";
import { fetchCanvasTasks, fetchNusModsSchedule, fetchNusModsWorkloads } from "@/app/api/src/services/apiFetchService";
import { getUserTasks, getUserSchedule } from "@/app/api/src/services/dataService";
import { formatContextForLLM } from "@/app/api/src/services/ragService";
import { llmService } from "@/app/api/src/services/llmService";
import { agoraService } from "@/app/api/src/services/agoraService";
import { StudyTask, ScheduleEvent } from "@/app/api/src/types";

// apps/web/app/api/chat/route.ts
export async function POST(req: Request) {
  try {
    const {
      message,
      canvasToken,
      nusmodsShareLink,
      useTTS,
      context,
      semester: semesterRaw,
      mood,
      completionPercentage,
    } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const userId = "default-user";

    // Optional semester override; default to Sem 2
    const semester = Number.isFinite(Number(semesterRaw)) ? Number(semesterRaw) : 2;

    const intent = analyzeQuestionIntent(message);

    let tasks: StudyTask[] = [];
    let events: ScheduleEvent[] = [];
    let moduleWorkloads: Record<string, number> = {};

    const fetchPromises: Promise<void>[] = [];

    if (intent === "RIGHTNOW" || intent === "BOTH" || intent === "GENERAL") {
      if (canvasToken) {
        fetchPromises.push(fetchCanvasTasks(canvasToken).then((r) => { tasks = r; }));
      } else {
        tasks = await getUserTasks(userId);
      }
    }

    if (intent === "SCHEDULE" || intent === "BOTH" || intent === "GENERAL") {
      if (nusmodsShareLink) {
        fetchPromises.push(
          fetchNusModsSchedule(nusmodsShareLink, userId, semester).then((r) => { events = r; }),
          fetchNusModsWorkloads(nusmodsShareLink, semester).then((r) => { moduleWorkloads = r; }),
        );
      } else {
        events = await getUserSchedule(userId);
      }
    }

    await Promise.all(fetchPromises);

    const currentTime = new Date();
    let ragContext = await formatContextForLLM(tasks, events, currentTime, moduleWorkloads);

    if (context) {
      ragContext += `\n\nFRONTEND CONTEXT:\n${JSON.stringify(context, null, 2)}`;
    }

    const assistantMessage = await llmService.chat(userId, message, ragContext, mood, completionPercentage);

    let audioUrl: string | null = null;
    if (useTTS) {
      audioUrl = await agoraService.generateTTS(assistantMessage, mood);
    }

    return NextResponse.json({ reply: assistantMessage, audioUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Error processing chat request: ${errorMessage}` }, { status: 500 });
  }
}

