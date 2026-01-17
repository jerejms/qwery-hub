import { NextResponse } from "next/server";
import { analyzeQuestionIntent } from "@/app/api/src/services/questionAnalysisService";
import { fetchCanvasTasks, fetchNusModsSchedule, fetchNusModsWorkloads } from "@/app/api/src/services/apiFetchService";
import { getUserTasks, getUserSchedule } from "@/app/api/src/services/dataService";
import { formatContextForLLM } from "@/app/api/src/services/ragService";
import { llmService } from "@/app/api/src/services/llmService";
import { agoraService } from "@/app/api/src/services/agoraService";
import { StudyTask, ScheduleEvent } from "@/app/api/src/types";

export async function POST(req: Request) {
  try {
    const { message, canvasToken, nusmodsShareLink, useTTS, context } = await req.json();

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
    let moduleWorkloads: Record<string, number> = {};

    // Fetch from APIs based on question intent - parallelize when possible
    const fetchPromises: Promise<void>[] = [];

    if (intent === "RIGHTNOW" || intent === "BOTH" || intent === "GENERAL") {
      // Fetch Canvas tasks if token is provided
      if (canvasToken) {
        fetchPromises.push(
          fetchCanvasTasks(canvasToken).then(result => { tasks = result; })
        );
      } else {
        // Fallback to JSON file if no token
        tasks = await getUserTasks(userId);
      }
    }

    if (intent === "SCHEDULE" || intent === "BOTH" || intent === "GENERAL") {
      // Fetch NUSMods schedule if share link is provided
      if (nusmodsShareLink) {
        // Fetch schedule and workload in parallel since they use the same data source
        fetchPromises.push(
          fetchNusModsSchedule(nusmodsShareLink, userId).then(result => { events = result; }),
          fetchNusModsWorkloads(nusmodsShareLink).then(result => { moduleWorkloads = result; })
        );
      } else {
        // Fallback to JSON file if no share link
        events = await getUserSchedule(userId);
      }
    }

    // Wait for all API calls to complete in parallel
    await Promise.all(fetchPromises);

    // Format context for LLM
    const currentTime = new Date();
    let ragContext = await formatContextForLLM(tasks, events, currentTime, moduleWorkloads);

    // Add frontend context (current task, next task, etc.) if provided
    if (context) {
      ragContext += `\n\nFRONTEND CONTEXT:\n${JSON.stringify(context, null, 2)}`;
    }

    // Call LLM with context
    const assistantMessage = await llmService.chat(userId, message, ragContext);

    // Optionally generate TTS audio
    let audioUrl: string | null = null;
    if (useTTS) {
      console.log('TTS requested, generating audio...');
      audioUrl = await agoraService.generateTTS(assistantMessage);
      console.log(`TTS result: ${audioUrl ? `Success (${audioUrl.length} chars)` : 'Failed (null)'}`);
    }

    // Return response in format expected by frontend
    return NextResponse.json({
      reply: assistantMessage,
      audioUrl,
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
