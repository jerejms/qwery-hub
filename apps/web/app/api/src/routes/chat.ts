// Chat router - POST /chat endpoint with RAG context
import { Router, Request, Response } from 'express';
import { ChatRequest, ChatResponse, StudyTask, ScheduleEvent } from '../types';
import { getUserTasks, getUserSchedule } from '../services/dataService';
import { formatContextForLLM } from '../services/ragService';
import { llmService } from '../services/llmService';
import { agoraService } from '../services/agoraService';
import { analyzeQuestionIntent } from '../services/questionAnalysisService';
import { fetchCanvasTasks, fetchNusModsSchedule, fetchNusModsWorkloads } from '../services/apiFetchService';

const router = Router();

/**
 * Chat endpoint that uses RAG context to provide grounded responses.
 * 
 * 1. Analyze question to determine which API(s) to call
 * 2. Fetch data from relevant APIs (Canvas for RightNow, NUSMods for Schedule)
 * 3. Format context for LLM
 * 4. Call LLM with context
 * 5. Optionally generate TTS audio
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const request: ChatRequest = req.body;

    // Analyze question to determine which API to call
    const intent = analyzeQuestionIntent(request.message);

    let tasks: StudyTask[] = [];
    let events: ScheduleEvent[] = [];
    let moduleWorkloads: Record<string, number> = {};

    // Fetch from APIs based on question intent
    if (intent === 'RIGHTNOW' || intent === 'BOTH' || intent === 'GENERAL') {
      // Fetch Canvas tasks if token is provided
      if (request.canvasToken) {
        tasks = await fetchCanvasTasks(request.canvasToken);
      } else {
        // Fallback to JSON file if no token
        tasks = await getUserTasks(request.userId);
      }
    }

    if (intent === 'SCHEDULE' || intent === 'BOTH' || intent === 'GENERAL') {
      // Fetch NUSMods schedule if share link is provided
      if (request.nusmodsShareLink) {
        events = await fetchNusModsSchedule(request.nusmodsShareLink, request.userId);
        // Also fetch workload data
        moduleWorkloads = await fetchNusModsWorkloads(request.nusmodsShareLink);
      } else {
        // Fallback to JSON file if no share link
        events = await getUserSchedule(request.userId);
      }
    }

    // Format context for LLM
    const currentTime = new Date();
    const ragContext = await formatContextForLLM(tasks, events, currentTime, moduleWorkloads);

    // Call LLM with context
    const assistantMessage = await llmService.chat(request.userId, request.message, ragContext);

    // Optionally generate TTS audio
    let audioUrl: string | null = null;
    if (request.useTTS) {
      audioUrl = await agoraService.generateTTS(assistantMessage);
    }

    const response: ChatResponse = {
      assistantMessage,
      audioUrl,
    };

    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Error processing chat request: ${errorMessage}` });
  }
});

export default router;
