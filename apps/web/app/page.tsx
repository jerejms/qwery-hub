"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { postJSON } from "@/lib/api";
import { parseNusmodsShareLink } from "@/lib/nusmods";
import { pickNextTask, RightNowTask } from "@/lib/rightNow";
import { Avatar } from "./components/Avatar";
import { WelcomeOverlay } from "./components/WelcomeOverlay";

type Msg = { role: "user" | "assistant"; content: string };

// Safe UUID generator (prevents crypto.randomUUID crashes on older browsers)
function safeUUID(): string {
  const c = (globalThis as any)?.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  // ===== Welcome Overlay =====
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem("qwery-hub-hasVisited");
    if (!hasVisited) {
      setShowWelcome(true);
    }
  }, []);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("qwery-hub-hasVisited", "true");
  };

  // ===== Kernel task pools =====
  const [canvasTasks, setCanvasTasks] = useState<RightNowTask[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<RightNowTask[]>([]);
  const [currentTask, setCurrentTask] = useState<RightNowTask | null>(null);

  // Done / skipped tracking (client-side)
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [skippedTaskIds, setSkippedTaskIds] = useState<Set<string>>(new Set());

  // ===== Chat =====
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! I’m your study buddy. What are we doing today?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useTTS, setUseTTS] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Debug: Log TTS state changes
  useEffect(() => {
    console.log("🔊 TTS State Changed:", useTTS);
  }, [useTTS]);

  // Auto-scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ===== Connect/Sync =====
  const [connectOpen, setConnectOpen] = useState(false);
  const [canvasToken, setCanvasToken] = useState("");
  const [nusmodsShareLink, setNusmodsShareLink] = useState("");
  const [syncStatus, setSyncStatus] = useState("Not connected");
  const [syncCounts, setSyncCounts] = useState<{ tasks: number; modules: number } | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  // ===== Schedule widget =====
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // ===== Right Now =====
  const [loadingNext, setLoadingNext] = useState(false);

  // ===== Break Timer System =====
  const [consecutiveCompletions, setConsecutiveCompletions] = useState(0);
  const [breakActive, setBreakActive] = useState(false);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(600); // 10 minutes in seconds

  // Break timer countdown
  useEffect(() => {
    if (!breakActive) return;

    const interval = setInterval(() => {
      setBreakTimeRemaining((prev) => {
        if (prev <= 1) {
          // Break time is over!
          clearInterval(interval);
          setBreakActive(false);
          setBreakTimeRemaining(600);

          // Alert user that break is over
          if (typeof window !== "undefined") {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ0QVKzn77BdGQg+ltfzzH0pBSZ7yvDbkUELElyx6OqqVxYLRZ7i8L5tIgU2iM/z1YU1Bx5vwfDkmFAMD1Sm5/CxXhoIPJbY88t8KAUndsr03JFBCxFcr+ntq1kXC0Se4/C+bCIFN4nQ89WENgceb8Hw5JhQCw9Upufws18aCDuW2PPLfCgFJ3bK9NyRQQsRXK/o7ataFwtFnuPwvmwiBTeJ0PPVhDYHHm/B8OSYUAsPVKbn8LNfGgg7ltjzy3woBSd2yvTckUELEVyv6O+rWhcLRZ7j8L5sIgU3idDz1YQ2Bx5vwfDkmFALD1Sm5/CzXxoIO5bY88t8KAUndsr03JFBCxFcr+jvq1oXC0We4/C+bCIFN4nQ89WENgceb8Hw5JhQCw9Upufws18aCDuW2PPLfCgFJ3bK9NyRQQsRXK/o76taFwtFnuPwvmwiBTeJ0PPVhDYHHm/B8OSYUAsPVKbn8LNfGgg7ltjzy3woBSd2yvTckUELEVyv6O+rWhcLRZ7j8L5sIgU3idDz1YQ2Bx5vwfDkmFALD1Sm5/CzXxoIO5bY88t8KAUndsr03JFBCxFcr+jvq1oXC0We4/C+bCIFN4nQ89WENgceb8Hw5JhQCw9Upufws18aCDuW2PPLfCgFJ3bK9NyRQQsRXK/o76taFwtFnuPwvmwiBTeJ0PPVhDYHHm/B8OSYUAsPVKbn8LNfGgg7ltjzy3woBSd2yvTckUELEVyv6O+rWhcLRZ7j8L5sIgU3idDz1YQ2Bx5vwfDkmFALD1Sm5/CzXxoIO5bY88t8KAUndsr03JFBCxFcr+jvq1oXC0We4/C+bCIFN4nQ89WENgceb8Hw5JhQCw9Upufws18aCDuW2PPLfCgFJ3bK9NyRQQsRXK/o76taFwtFnuPwvmwiBTeJ0PPVhDYHHm/B8OSYUAsPVKbn8LNfGgg7ltjzy3woBSd2yvTckUELEVyv6O+rWhcLRZ7j8L5sIgU3idDz1YQ2Bx5vwfDkmFALD1Sm5/CzXxoIO5bY88t8KAUndsr03JFBCxFcr+jvq1oXC0We4/C+bCIFN4nQ89WENgceb8Hw5JhQCw9Upufws18aCDuW2PPLfCgFJ3bK9NyRQQsRXK/o76taFwtFnuPwvmwiBTeJ0PPVhDYHHm/B8OSYUAsPVKbn8LNfGgg7ltjzy3woBSd2yvTckUELEVyv6O+rWhcLRZ7j8L5sIgU3idDz1YQ2Bx5vwfDkmFALD1Sm5/CzXxoIO5bY88t8KAUndsr03JFBCxFcr+jvq1oXC0We4/C+");
            audio.play().catch(() => { });
            alert("Break time is over! Ready to get back to work? 💪");
          }
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breakActive]);

  // ===== Mood System =====
  // Calculate buddy mood based on urgent tasks and completion percentage
  const calculateMood = (): "stressed" | "normal" | "happy" => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Calculate total tasks and completion percentage
    const totalTasks = canvasTasks.length + scheduleTasks.length;
    const completedTasks = doneTaskIds.size;
    const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Get undone tasks due within 7 days
    const urgentTasks = [...canvasTasks, ...scheduleTasks].filter((task) => {
      if (doneTaskIds.has(task.id)) return false;
      if (!task.dueAtMs) return false;
      const timeUntilDue = task.dueAtMs - now;
      return timeUntilDue > 0 && timeUntilDue <= sevenDaysMs;
    });

    const urgentCount = urgentTasks.length;
    const totalUndone = canvasTasks.filter((t) => !doneTaskIds.has(t.id)).length +
      scheduleTasks.filter((t) => !doneTaskIds.has(t.id)).length;

    // Happy: Over 50% of all tasks completed (reward their progress!)
    if (completionPercentage >= 50) {
      return "happy";
    }

    // Stressed: 3+ urgent tasks OR 50%+ of remaining tasks are urgent
    if (urgentCount >= 3 || (totalUndone > 0 && urgentCount / totalUndone >= 0.5)) {
      return "stressed";
    }

    return "normal";
  };

  const buddyMood = calculateMood();

  // Debug: Log mood changes
  useEffect(() => {
    const totalTasks = canvasTasks.length + scheduleTasks.length;
    const completionPercentage = totalTasks > 0 ? ((doneTaskIds.size / totalTasks) * 100).toFixed(1) : 0;

    const urgentTasks = [...canvasTasks, ...scheduleTasks].filter((task) => {
      if (doneTaskIds.has(task.id)) return false;
      if (!task.dueAtMs) return false;
      const timeUntilDue = task.dueAtMs - Date.now();
      return timeUntilDue > 0 && timeUntilDue <= 7 * 24 * 60 * 60 * 1000;
    });

    console.log("Mood System Status:", {
      mood: buddyMood,
      completionPercentage: `${completionPercentage}%`,
      totalTasks: totalTasks,
      doneCount: doneTaskIds.size,
      urgentTasksCount: urgentTasks.length,
      urgentTasks: urgentTasks.map(t => ({ title: t.title, dueAt: t.dueAtMs ? new Date(t.dueAtMs).toLocaleString() : 'No due date' }))
    });
  }, [buddyMood, canvasTasks, scheduleTasks, doneTaskIds]);
  const [rightNowBusy, setRightNowBusy] = useState(false);


  // TTS audio: prevent overlap + stale state flips
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTokenRef = useRef(0);

  function taskModuleCode(t?: RightNowTask | null): string | null {
    if (!t) return null;

    // common module code pattern e.g. CS2040C, MA1508E, EE2111A
    const m1 = t.title.match(/\b[A-Z]{2,3}\d{4}[A-Z]?\b/);
    if (m1) return m1[0];

    const m2 = t.id.match(/\b[A-Z]{2,3}\d{4}[A-Z]?\b/);
    if (m2) return m2[0];

    return null;
  }

  // ---------------------------
  // Fallback: if no Canvas assignments, study 30 min for a lecture module
  // ---------------------------
  function buildFallbackStudyTaskVariant(args?: {
    avoidSet?: Set<string>;
    preferDifferentModuleThan?: string | null;
    doneSet?: Set<string>;
    skippedSet?: Set<string>;
  }): RightNowTask | null {
    if (!upcomingClasses || upcomingClasses.length === 0) return null;

    const avoidSet = args?.avoidSet ?? new Set<string>();
    const doneSet = args?.doneSet ?? doneTaskIds;
    const skippedSet = args?.skippedSet ?? skippedTaskIds;
    const preferDiffFrom = args?.preferDifferentModuleThan ?? taskModuleCode(currentTask);

    const isLecture = (c: any) => {
      const lt = (c.lessonType ?? "").toString().toLowerCase();
      return lt.includes("lec") || lt.includes("lecture");
    };

    const sorted = [...upcomingClasses].sort((a, b) => (a.startAtMs ?? 0) - (b.startAtMs ?? 0));

    // Prefer lecture, but also prefer not repeating same module if possible
    const candidates = [
      ...sorted.filter(isLecture),
      ...sorted.filter((c) => !isLecture(c)),
    ];

    for (const c of candidates) {
      const moduleCode = c.moduleCode ?? "a module";
      const startAtMs = c.startAtMs ?? undefined;
      const id = `study:${moduleCode}:${startAtMs ?? "na"}`;

      if (doneSet.has(id) || skippedSet.has(id) || avoidSet.has(id)) continue;
      if (preferDiffFrom && moduleCode === preferDiffFrom) {
        // try other modules first
        continue;
      }

      return {
        id,
        title: `Study ${moduleCode} for 30 minutes`,
        source: "schedule",
        importance: 3,
        estimatedHours: 0.5,
        difficulty: 2,
        dueAtMs: startAtMs,
      };
    }

    // If we couldn't avoid repeating module, allow repeat as last resort
    for (const c of candidates) {
      const moduleCode = c.moduleCode ?? "a module";
      const startAtMs = c.startAtMs ?? undefined;
      const id = `study:${moduleCode}:${startAtMs ?? "na"}`;

      if (doneSet.has(id) || skippedSet.has(id) || avoidSet.has(id)) continue;

      return {
        id,
        title: `Study ${moduleCode} for 30 minutes`,
        source: "schedule",
        importance: 3,
        estimatedHours: 0.5,
        difficulty: 2,
        dueAtMs: startAtMs,
      };
    }

    return null;
  }


  // ---------------------------
  // Choose next task deterministically with done/skip filtering + fallback
  // ---------------------------
  function chooseNextTask(opts?: {
    avoidId?: string;
    doneOverride?: Set<string>;
    skippedOverride?: Set<string>;
    preferDifferentModuleThan?: string | null;
  }): RightNowTask | null {
    const avoidId = opts?.avoidId;
    const doneSet = opts?.doneOverride ?? doneTaskIds;
    const skippedSet = opts?.skippedOverride ?? skippedTaskIds;
    const preferDiffFrom = opts?.preferDifferentModuleThan ?? taskModuleCode(currentTask);

    const avoidSet = new Set<string>();
    if (avoidId) avoidSet.add(avoidId);
    for (const id of skippedSet) avoidSet.add(id);

    const canvas = canvasTasks.filter((t) => !doneSet.has(t.id) && !avoidSet.has(t.id));
    const sched = scheduleTasks.filter((t) => !doneSet.has(t.id) && !avoidSet.has(t.id));

    // Try not to repeat the same module if possible
    const canvasAlt = preferDiffFrom ? canvas.filter((t) => taskModuleCode(t) !== preferDiffFrom) : canvas;
    const schedAlt = preferDiffFrom ? sched.filter((t) => taskModuleCode(t) !== preferDiffFrom) : sched;

    const alt = pickNextTask(canvasAlt, schedAlt);
    if (alt) return alt;

    const normal = pickNextTask(canvas, sched);
    if (normal) return normal;

    // fallback: build 30-min study task from upcoming classes, but avoid repeating module if possible
    const fallbackCandidates = [...(upcomingClasses ?? [])].sort(
      (a, b) => (a.startAtMs ?? 0) - (b.startAtMs ?? 0)
    );

    const makeFallback = (c: any) => {
      const moduleCode = c.moduleCode ?? "a module";
      const startAtMs = c.startAtMs ?? undefined;
      const id = `study:${moduleCode}:${startAtMs ?? "na"}`;
      return {
        id,
        title: `Study ${moduleCode} for 30 minutes`,
        source: "schedule" as const,
        importance: 3,
        estimatedHours: 0.5,
        difficulty: 2,
        dueAtMs: startAtMs,
      } satisfies RightNowTask;
    };

    for (const c of fallbackCandidates) {
      const mod = c.moduleCode ?? null;
      const fb = makeFallback(c);
      if (doneSet.has(fb.id) || skippedSet.has(fb.id) || avoidSet.has(fb.id)) continue;
      if (preferDiffFrom && mod === preferDiffFrom) continue;
      return fb;
    }

    for (const c of fallbackCandidates) {
      const fb = makeFallback(c);
      if (doneSet.has(fb.id) || skippedSet.has(fb.id) || avoidSet.has(fb.id)) continue;
      return fb;
    }

    return null;
  }



  // ---------------------------
  // Helper: Send message to LLM
  // ---------------------------
  async function sendToLLM(userMessage: string, context?: any, addUserMessage = true) {
    console.log("🚀 sendToLLM called with:", {
      userMessage: userMessage.substring(0, 50),
      useTTS,
      mood: buddyMood,
      addUserMessage
    });

    setSending(true);

    if (addUserMessage) {
      setMessages((m) => [...m, { role: "user", content: userMessage }]);
    }

    try {
      console.log("📡 Calling /api/chat with useTTS:", useTTS);

      // Calculate completion percentage for encouraging near-milestone responses
      const totalTasks = canvasTasks.length + scheduleTasks.length;
      const completionPercentage = totalTasks > 0 ? (doneTaskIds.size / totalTasks) * 100 : 0;

      const data = await postJSON<{ reply: string; audioUrl?: string | null }>("/api/chat", {
        message: userMessage,
        canvasToken: canvasToken || undefined,
        nusmodsShareLink: nusmodsShareLink || undefined,
        useTTS,
        context: context || {},
        mood: buddyMood,
        completionPercentage: Math.round(completionPercentage),
      });

      console.log("📨 API Response received:", {
        hasReply: !!data.reply,
        hasAudioUrl: !!data.audioUrl,
        audioUrlLength: data.audioUrl?.length
      });

      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);

      // Debug TTS
      console.log("TTS Status:", {
        useTTS,
        hasAudioUrl: !!data.audioUrl,
        audioUrlLength: data.audioUrl?.length,
        audioUrlPrefix: data.audioUrl?.substring(0, 50)
      });

      if (useTTS && data.audioUrl) {
        console.log("✅ Playing TTS audio...");

        // Invalidate previous audio callbacks
        const token = ++audioTokenRef.current;

        // Stop previous audio if any
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          console.log("🔊 Audio started playing");
          if (audioTokenRef.current === token) setIsAudioPlaying(true);
        };
        audio.onended = () => {
          console.log("✅ Audio finished");
          if (audioTokenRef.current === token) setIsAudioPlaying(false);
        };
        audio.onerror = (e) => {
          console.error("❌ Audio error:", e, audio.error);
          if (audioTokenRef.current === token) setIsAudioPlaying(false);
        };

        audio.play().catch((err) => {
          console.error("❌ Audio play failed:", err);
          if (audioTokenRef.current === token) setIsAudioPlaying(false);
        });
      } else if (useTTS && !data.audioUrl) {
        console.warn("⚠️ TTS enabled but no audioUrl received from API");
      }

      return data.reply;
    } catch (e: any) {
      const errorMsg = `Error: ${e.message}`;
      setMessages((m) => [...m, { role: "assistant", content: errorMsg }]);
      return null;
    } finally {
      setSending(false);
    }
  }

  // ---------------------------
  // Right Now: Prompt / Finish / Skip
  // ---------------------------
  async function promptRightNow() {
    if (rightNowBusy || sending) return;
    setRightNowBusy(true);
    setLoadingNext(true);
    try {
      const chosen = chooseNextTask();
      setCurrentTask(chosen);

      const context = {
        action: "prompt_task",
        currentTask: chosen,
        availableTasks: {
          canvas: canvasTasks.filter((t) => !doneTaskIds.has(t.id)).length,
          schedule: scheduleTasks.filter((t) => !doneTaskIds.has(t.id)).length,
        },
      };

      await sendToLLM("What should I work on right now?", context);
    } finally {
      setLoadingNext(false);
      setRightNowBusy(false);
    }
  }


  async function handleFinish() {
    if (!currentTask || rightNowBusy || sending) return;
    setRightNowBusy(true);
    try {
      const finished = currentTask;

      const nextDone = new Set(doneTaskIds);
      nextDone.add(finished.id);
      setDoneTaskIds(nextDone);

      // Track consecutive completions for break timer
      const newCompletionCount = consecutiveCompletions + 1;
      setConsecutiveCompletions(newCompletionCount);

      // Trigger break after 3 consecutive completions
      if (newCompletionCount >= 3) {
        setBreakActive(true);
        setBreakTimeRemaining(600); // Reset to 10 minutes
        setConsecutiveCompletions(0); // Reset counter
      }

      const nextTask = chooseNextTask({
        avoidId: finished.id,
        doneOverride: nextDone,
        preferDifferentModuleThan: taskModuleCode(finished),
      });
      setCurrentTask(nextTask);

      const context = {
        action: "finish_task",
        finishedTask: finished,
        nextTask,
        remainingTasks: {
          canvas: canvasTasks.filter((t) => !nextDone.has(t.id)).length,
          schedule: scheduleTasks.filter((t) => !nextDone.has(t.id)).length,
        },
      };

      await sendToLLM(`I just finished: ${finished.title}`, context);
    } finally {
      setRightNowBusy(false);
    }
  }


  async function handleSkip() {
    if (!currentTask || rightNowBusy || sending) return;
    setRightNowBusy(true);
    try {
      const skipped = currentTask;

      const nextSkipped = new Set(skippedTaskIds);
      nextSkipped.add(skipped.id);
      setSkippedTaskIds(nextSkipped);

      const nextTask = chooseNextTask({
        avoidId: skipped.id,
        skippedOverride: nextSkipped,
        preferDifferentModuleThan: taskModuleCode(skipped),
      });
      setCurrentTask(nextTask);

      const context = {
        action: "skip_task",
        skippedTask: skipped,
        nextTask,
        availableTasks: {
          canvas: canvasTasks.filter((t) => !doneTaskIds.has(t.id) && !nextSkipped.has(t.id)).length,
          schedule: scheduleTasks.filter((t) => !doneTaskIds.has(t.id) && !nextSkipped.has(t.id)).length,
        },
      };

      await sendToLLM(`I want to skip: ${skipped.title}`, context);
    } finally {
      setRightNowBusy(false);
    }
  }


  // ---------------------------
  // Chat send
  // ---------------------------
  async function send() {
    console.log("📤 Send button clicked! canSend:", canSend, "useTTS:", useTTS);

    if (!canSend) {
      console.log("❌ Cannot send - canSend is false");
      return;
    }

    const text = input.trim();
    console.log("📝 Message text:", text);

    setInput("");

    const context = {
      currentTask: currentTask,
      availableTasks: {
        canvas: canvasTasks.filter((t) => !doneTaskIds.has(t.id)).length,
        schedule: scheduleTasks.filter((t) => !doneTaskIds.has(t.id)).length,
      },
    };

    await sendToLLM(text, context, true);
  }

  // ---------------------------
  // Sync
  // ---------------------------
  async function sync() {
    let codes: string[] = [];
    try {
      codes = nusmodsShareLink ? parseNusmodsShareLink(nusmodsShareLink).moduleCodes : [];
    } catch {
      setSyncStatus("Invalid NUSMods link ❌ (paste the full Share/Sync link)");
      setSyncCounts(null);
      return;
    }

    setSyncStatus("Syncing...");
    setSyncCounts(null);

    try {
      const data = await postJSON<{
        modules: any[];
        assignments: any[];
        tasksCount: number;
        modulesCount: number;
      }>("/api/integrations/fetch-sync", {
        canvasToken,
        moduleCodes: codes,
        nusmodsShareLink,
      });

      setSyncStatus("Synced ✅");
      setSyncCounts({ tasks: data.tasksCount, modules: data.modulesCount });

      // Canvas assignments -> RightNowTask (safeUUID prevents crypto.randomUUID crashes)
      const ct: RightNowTask[] = (data.assignments ?? []).map((a: any) => ({
        id: `canvas:${a.id ?? a.title ?? safeUUID()}`,
        title: a.title ?? a.name ?? "Canvas task",
        source: "canvas" as const,
        importance: 5,
        estimatedHours: 1,
        difficulty: 3,
        dueAtMs: a.dueDate ? new Date(a.dueDate).getTime() : undefined,
      }));

      setCanvasTasks(ct);

      // reset done/skips on new sync (optional but sane)
      setDoneTaskIds(new Set());
      setSkippedTaskIds(new Set());
      setCurrentTask(null);

      await refreshUpcomingClasses(nusmodsShareLink);

      setConnectOpen(false);
    } catch (e: any) {
      setSyncStatus(`Sync failed ❌ ${e.message}`);
      setSyncCounts(null);
    }
  }

  // ---------------------------
  // Schedule refresh
  // ---------------------------
  async function refreshUpcomingClasses(linkOverride?: string) {
    const link = linkOverride ?? nusmodsShareLink;
    if (!link) {
      setUpcomingClasses([]);
      setScheduleTasks([]);
      return;
    }

    setLoadingSchedule(true);
    try {
      const data = await postJSON<{ items: any[] }>("/api/schedule/upcoming", {
        nusmodsShareLink: link,
        semester: 2,
        days: 3,
      });

      const items = data.items ?? [];
      setUpcomingClasses(items);

      // Upcoming classes -> prep tasks
      const st: RightNowTask[] = items.map((c: any, idx: number) => ({
        id: `schedule:${c.moduleCode ?? idx}:${c.lessonType ?? ""}:${c.classNo ?? ""}:${c.startAtMs ?? idx
          }`,
        title: `Prep: ${c.moduleCode} ${c.lessonType} (${c.classNo})`,
        source: "schedule" as const,
        importance: 2,
        estimatedHours: 0.5,
        difficulty: 2,
        dueAtMs: c.startAtMs ?? undefined,
      }));
      setScheduleTasks(st);
    } catch (e: any) {
      setUpcomingClasses([{ error: e.message ?? "Failed to load schedule" }]);
      setScheduleTasks([]);
    } finally {
      setLoadingSchedule(false);
    }
  }

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div className="min-h-screen flex bg-slate-950 text-white">
      {/* LEFT: CHAT */}
      <main className="flex-1 p-4 border-r border-white/10 flex flex-col bg-slate-950">
        <div className="flex items-center justify-between bg-black p-2 -m-2 mb-2 rounded-lg">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="qwery-hub logo"
              width={128}
              height={40}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10"
            onClick={() => setConnectOpen(true)}
          >
            Connect
          </button>
        </div>

        {/* Avatar/Image at the top */}
        <div className="flex-1 relative overflow-hidden mt-4">
          <Avatar isTalking={isAudioPlaying} mood={buddyMood} />
        </div>

        {/* Chat messages container */}
        <div className="h-[40vh] rounded-lg border border-white/10 bg-zinc-950 p-3 overflow-auto space-y-3 mb-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] rounded-lg bg-white/10 px-3 py-2"
                  : "mr-auto max-w-[80%] rounded-lg border border-white/10 px-3 py-2"
              }
            >
              <div className="text-xs opacity-60">{m.role}</div>
              <div>{m.content}</div>
            </div>
          ))}

          {sending && (
            <div className="mr-auto max-w-[80%] rounded-lg border border-white/10 px-3 py-2">
              <div className="text-xs opacity-60">assistant</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
                <span className="text-xs opacity-60">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-4 flex gap-2 sticky bottom-0 bg-slate-950 pt-2 pb-2">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
            placeholder="Ask your study buddy..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if ((e.nativeEvent as any).isComposing) return;
              send();
            }}
          />

          <button
            className={`relative rounded-lg border px-3 py-2 transition-colors ${useTTS
              ? "bg-white/10 border-white/10 hover:bg-white/15"
              : "border-red-500/30 hover:bg-red-500/10"
              }`}
            onClick={() => {
              const newState = !useTTS;
              console.log("🔊 TTS button clicked, new state:", newState);
              setUseTTS(newState);
            }}
            title={useTTS ? "Disable text-to-speech" : "Enable text-to-speech"}
            type="button"
          >
            <span className="text-lg">{useTTS ? "🔊" : "🔇"}</span>
            {!useTTS && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-red-500 rounded-full text-white text-xs font-bold">
                ✕
              </span>
            )}
          </button>

          <button
            className="rounded-lg border border-white/10 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
            disabled={!canSend}
            onClick={send}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </main>

      {/* RIGHT: WIDGETS */}
      <aside className="w-80 p-4 bg-black">
        <h2 className="text-lg font-semibold">Widgets</h2>
        <div className="mt-3 text-sm opacity-70">
          {syncStatus}
          {syncCounts && (
            <span>
              {" "}Canvas tasks: <span className="font-semibold text-blue-400">{syncCounts.tasks}</span>, Modules: <span className="font-semibold text-white">{syncCounts.modules}</span>
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {/* RIGHT NOW */}
          <div className="rounded-lg border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="bg-white/5 p-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-red-500">!</span>
                  <span className="font-semibold">Right Now</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    {canvasTasks.filter((t) => !doneTaskIds.has(t.id)).length}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-white/70 border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60"></span>
                    {scheduleTasks.filter((t) => !doneTaskIds.has(t.id)).length}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              {(canvasTasks.length > 0 || scheduleTasks.length > 0) && (
                <div className="mt-2">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${((doneTaskIds.size / (canvasTasks.length + scheduleTasks.length)) * 100)
                          }%`,
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    {doneTaskIds.size} / {canvasTasks.length + scheduleTasks.length} completed
                  </div>
                </div>
              )}
            </div>

            {/* Task Card */}
            <div className="p-3">
              {currentTask ? (
                <div
                  className={`rounded-lg border-l-4 p-4 bg-white/5 transition-all duration-300 hover:bg-white/10 ${currentTask.source === "canvas"
                    ? "border-l-blue-500"
                    : "border-l-white/40"
                    }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-base mb-1">{currentTask.title}</div>
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span className="capitalize">{currentTask.source}</span>
                        {currentTask.estimatedHours && (
                          <span>• {currentTask.estimatedHours}h</span>
                        )}
                      </div>
                    </div>
                    {currentTask.importance && (
                      <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(currentTask.importance, 5) }).map((_, i) => (
                          <span key={i} className="text-yellow-400 text-xs">⭐</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {currentTask.dueAtMs && (
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${Date.now() > currentTask.dueAtMs
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : currentTask.dueAtMs - Date.now() < 24 * 60 * 60 * 1000
                            ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                            : "bg-green-500/20 text-green-300 border border-green-500/30"
                          }`}
                      >
                        Due: {new Date(currentTask.dueAtMs).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-sm text-white/60 mb-1">
                    {canvasTasks.length === 0 && scheduleTasks.length === 0
                      ? "Sync your data to get started"
                      : "No recommendation yet"}
                  </div>
                  <div className="text-xs text-white/40">
                    Click Get Next below to see your next task
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={handleFinish}
                  disabled={!currentTask}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="font-medium">Complete</span>
                </button>

                <button
                  onClick={handleSkip}
                  disabled={!currentTask}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="font-medium">Skip</span>
                </button>

                <button
                  onClick={promptRightNow}
                  disabled={loadingNext}
                  className="col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="font-medium">{loadingNext ? "Loading..." : "Get Next"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* SCHEDULE */}
          <div className="rounded-lg border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="bg-white/5 p-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span className="font-semibold">Schedule</span>
              </div>
              <button
                className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 transition-colors"
                onClick={() => refreshUpcomingClasses()}
              >
                {loadingSchedule ? "..." : "Refresh"}
              </button>
            </div>

            {/* Content */}
            <div className="p-3">
              {!nusmodsShareLink ? (
                <div className="text-sm text-white/50 text-center py-4">
                  Sync NUSMods first to see your classes
                </div>
              ) : upcomingClasses?.[0]?.error ? (
                <div className="text-sm text-red-300 text-center py-4">{upcomingClasses[0].error}</div>
              ) : upcomingClasses.length === 0 ? (
                <div className="text-sm text-white/50 text-center py-4">
                  No classes in the next 3 days
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {upcomingClasses.map((c, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border-l-4 border-l-white/40 bg-white/5 hover:bg-white/10 p-3 transition-colors"
                    >
                      <div className="font-semibold text-white mb-1">
                        {c.moduleCode} {c.lessonType}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span>{c.day}</span>
                        <span>•</span>
                        <span>{c.startTime}–{c.endTime}</span>
                      </div>
                      {c.venue && (
                        <div className="text-xs text-white/60 mt-1">
                          📍 {c.venue}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* CONNECT MODAL */}
      {connectOpen && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Connect data sources</div>
              <button onClick={() => setConnectOpen(false)}>✕</button>
            </div>

            <div className="mt-4 space-y-3">
              <label>
                <div className="text-sm opacity-70">Canvas token</div>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2"
                  value={canvasToken}
                  onChange={(e) => setCanvasToken(e.target.value)}
                />
              </label>

              <label>
                <div className="text-sm opacity-70">NUSMods Share/Sync link</div>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2"
                  placeholder="Paste your NUSMods Share/Sync link here"
                  value={nusmodsShareLink}
                  onChange={(e) => setNusmodsShareLink(e.target.value)}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setConnectOpen(false)}>Cancel</button>
                <button className="rounded bg-white/10 px-3 py-2 hover:bg-white/20" onClick={sync}>
                  Sync
                </button>
              </div>

              <div className="text-xs opacity-60 pt-2">
                After syncing, click <span className="font-semibold">Prompt</span>. Finish marks
                tasks as done; Skip gives another task. If no Canvas tasks, you’ll get a 30-min
                lecture study task.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WELCOME OVERLAY */}
      <WelcomeOverlay isOpen={showWelcome} onClose={handleCloseWelcome} />

      {/* BREAK TIMER OVERLAY */}
      {breakActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl p-8 text-center">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-green-500/20 p-6">
                <svg
                  className="w-16 h-16 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold mb-3">Time for a Break! 🎉</h2>
            <p className="text-white/70 mb-8">
              You've completed 3 tasks in a row. Great work! Take a 10-minute break to recharge.
            </p>

            {/* Timer Display */}
            <div className="mb-8">
              <div className="text-7xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                {Math.floor(breakTimeRemaining / 60)}:{(breakTimeRemaining % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-sm text-white/50 mt-2">minutes remaining</div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-blue-400 transition-all duration-1000 ease-linear"
                style={{ width: `${((600 - breakTimeRemaining) / 600) * 100}%` }}
              />
            </div>

            {/* Skip Break Button */}
            <button
              onClick={() => {
                setBreakActive(false);
                setBreakTimeRemaining(600);
              }}
              className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
            >
              Skip Break
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
