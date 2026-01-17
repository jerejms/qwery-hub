import { NextResponse } from "next/server";
import { analyzeQuestionIntent } from "@/app/api/src/services/questionAnalysisService";
import { fetchCanvasTasks, fetchNusModsSchedule } from "@/app/api/src/services/apiFetchService";
import { getUserTasks, getUserSchedule } from "@/app/api/src/services/dataService";
import { formatContextForLLM } from "@/app/api/src/services/ragService";
import { llmService } from "@/app/api/src/services/llmService";
import { StudyTask, ScheduleEvent } from "@/app/api/src/types";

export async function POST(req: Request) {
  try {
    const { message, canvasToken, nusmodsShareLink } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Use a default userId for now (could be enhanced with auth)
    const userId = "default-user";

    // Analyze question to determine which API to call
    const intent = analyzeQuestionIntent(message);

    let tasks: StudyTask[] = [];
    let events: ScheduleEvent[] = [];

    // Fetch from APIs based on question intent
    if (intent === "RIGHTNOW" || intent === "BOTH" || intent === "GENERAL") {
      // Fetch Canvas tasks if token is provided
      if (canvasToken) {
        tasks = await fetchCanvasTasks(canvasToken);
      } else {
        // Fallback to JSON file if no token
        tasks = await getUserTasks(userId);
      }
    }

    if (intent === "SCHEDULE" || intent === "BOTH" || intent === "GENERAL") {
      // Fetch NUSMods schedule if share link is provided
      if (nusmodsShareLink) {
        events = await fetchNusModsSchedule(nusmodsShareLink, userId);
      } else {
        // Fallback to JSON file if no share link
        events = await getUserSchedule(userId);
      }
    }

    // Format context for LLM
    const currentTime = new Date();
    const ragContext = await formatContextForLLM(tasks, events, currentTime);

    // Call LLM with context
    const assistantMessage = await llmService.chat(userId, message, ragContext);

    // Return response in format expected by frontend
    return NextResponse.json({
      reply: assistantMessage,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing chat request:", errorMessage);
    return NextResponse.json(
      { error: `Error processing chat request: ${errorMessage}` },
      { status: 500 }
    );
  }
}
