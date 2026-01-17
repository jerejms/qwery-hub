"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { postJSON } from "@/lib/api";
import { parseNusmodsShareLink } from "@/lib/nusmods";
import { pickNextTask, RightNowTask } from "@/lib/rightNow";
import { Avatar } from "./components/Avatar";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [canvasTasks, setCanvasTasks] = useState<RightNowTask[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<RightNowTask[]>([]);
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [skippedTaskIds, setSkippedTaskIds] = useState<Set<string>>(new Set());

  const [currentTask, setCurrentTask] = useState<RightNowTask | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! I'm your study buddy. What are we doing today?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useTTS, setUseTTS] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Auto-scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [connectOpen, setConnectOpen] = useState(false);
  const [canvasToken, setCanvasToken] = useState("");
  const [nusmodsShareLink, setNusmodsShareLink] = useState("");
  const [syncStatus, setSyncStatus] = useState("Not connected");

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);

  // Fallback: if no Canvas assignments, study 30 min for a lecture module
  function buildFallbackStudyTask(): RightNowTask | null {
    if (!upcomingClasses || upcomingClasses.length === 0) return null;

    const isLecture = (c: any) => {
      const lt = (c.lessonType ?? "").toString().toLowerCase();
      return lt.includes("lec") || lt.includes("lecture");
    };

    const pickEarliest = (arr: any[]) => {
      const sorted = [...arr].sort((a, b) => (a.startAtMs ?? 0) - (b.startAtMs ?? 0));
      return sorted[0] ?? null;
    };

    const lecture = pickEarliest(upcomingClasses.filter(isLecture));
    const chosenClass = lecture ?? pickEarliest(upcomingClasses);
    if (!chosenClass) return null;

    const moduleCode = chosenClass.moduleCode ?? "a module";
    const startAtMs = chosenClass.startAtMs ?? undefined;

    return {
      id: `study:${moduleCode}:${startAtMs ?? "na"}`,
      title: `Study ${moduleCode} for 30 minutes`,
      source: "schedule",
      importance: 3,
      estimatedHours: 0.5,
      difficulty: 2,
      dueAtMs: startAtMs,
    };
  }

  // Choose next task deterministically with done/skip filtering + fallback
  function chooseNextTask(opts?: { avoidId?: string }) {
    const avoidId = opts?.avoidId;

    // always remove done
    const canvas = canvasTasks.filter((t) => !doneTaskIds.has(t.id));
    const sched = scheduleTasks.filter((t) => !doneTaskIds.has(t.id));

    // avoid current + skipped
    const avoidSet = new Set<string>();
    if (avoidId) avoidSet.add(avoidId);
    for (const id of skippedTaskIds) avoidSet.add(id);

    let canvas2 = canvas.filter((t) => !avoidSet.has(t.id));
    let sched2 = sched.filter((t) => !avoidSet.has(t.id));

    // if everything got skipped, clear skips (not done) and try again
    if (canvas2.length === 0 && sched2.length === 0) {
      canvas2 = canvas;
      sched2 = sched;
      if (skippedTaskIds.size > 0) setSkippedTaskIds(new Set());
    }

    // if no Canvas assignments left, fallback to 30-min lecture study
    if (canvas2.length === 0) {
      const fallback = buildFallbackStudyTask();
      if (fallback) return fallback;
    }

    return pickNextTask(canvas2, sched2);
  }

  // Right Now: Prompt / Finish / Skip
  function promptRightNow() {
    setLoadingNext(true);
    try {
      const chosen = chooseNextTask();
      setCurrentTask(chosen);

      setMessages((m) => [
        ...m,
        { role: "user", content: "What should I work on right now?" },
        {
          role: "assistant",
          content: chosen
            ? `Right now: ${chosen.title} (source: ${chosen.source})`
            : "I don't have any tasks yet — sync Canvas/NUSMods first.",
        },
      ]);
    } finally {
      setLoadingNext(false);
    }
  }

  function handleFinish() {
    if (!currentTask) return;

    const finished = currentTask;

    // mark done
    setDoneTaskIds((prev) => {
      const next = new Set(prev);
      next.add(finished.id);
      return next;
    });

    const nextTask = chooseNextTask({ avoidId: finished.id });
    setCurrentTask(nextTask);

    setMessages((m) => [
      ...m,
      { role: "user", content: `✅ Finished: ${finished.title}` },
      { role: "assistant", content: `✅ Done: ${finished.title}` },
      ...(nextTask
        ? [{ role: "assistant" as const, content: `Next: ${nextTask.title} (source: ${nextTask.source})` }]
        : [{ role: "assistant" as const, content: "No next task right now — sync or add tasks." }]),
    ]);
  }

  function handleSkip() {
    if (!currentTask) return;

    const skipped = currentTask;

    // mark skipped
    setSkippedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(skipped.id);
      return next;
    });

    const nextTask = chooseNextTask({ avoidId: skipped.id });
    setCurrentTask(nextTask);

    setMessages((m) => [
      ...m,
      { role: "user", content: `⏭️ Skip: ${skipped.title}` },
      ...(nextTask
        ? [
          {
            role: "assistant" as const,
            content: `⏭️ Skipped. Try this instead: ${nextTask.title} (source: ${nextTask.source})`,
          },
        ]
        : [{ role: "assistant" as const, content: "Nothing else to suggest yet — sync first." }]),
    ]);
  }

  async function send() {
    if (!canSend) return;

    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);

    try {
      const data = await postJSON<{ reply: string; audioUrl?: string | null }>("/api/chat", {
        message: text,
        canvasToken: canvasToken || undefined,
        nusmodsShareLink: nusmodsShareLink || undefined,
        useTTS,
      });

      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);

      if (useTTS && data.audioUrl) {
        console.log('🔊 TTS enabled, audioUrl received, length:', data.audioUrl.length);
        const audio = new Audio(data.audioUrl);

        // Track audio playback state for avatar animation
        audio.onplay = () => {
          console.log('🎵 Audio started playing - setting isAudioPlaying to true');
          setIsAudioPlaying(true);
        };
        audio.onended = () => {
          console.log('🔇 Audio ended - setting isAudioPlaying to false');
          setIsAudioPlaying(false);
        };
        audio.onerror = (e) => {
          console.error('❌ Audio error:', e);
          setIsAudioPlaying(false);
        };

        audio.play()
          .then(() => console.log('✅ Audio.play() promise resolved'))
          .catch((err) => {
            console.error('❌ Audio.play() failed:', err);
            setIsAudioPlaying(false);
          });
      } else {
        console.log('⚠️ TTS debug - useTTS:', useTTS, 'audioUrl:', data.audioUrl ? 'present' : 'missing');
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  }

  async function sync() {
    let codes: string[] = [];
    try {
      codes = nusmodsShareLink ? parseNusmodsShareLink(nusmodsShareLink).moduleCodes : [];
    } catch {
      setSyncStatus("Invalid NUSMods link ❌ (paste the full Share/Sync link)");
      return;
    }

    setSyncStatus("Syncing...");

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

      setSyncStatus(`Synced ✅ Canvas tasks: ${data.tasksCount}, Modules: ${data.modulesCount}`);

      // Canvas assignments -> RightNowTask
      const ct: RightNowTask[] = (data.assignments ?? []).map((a: any) => ({
        id: `canvas:${a.id ?? a.title ?? crypto.randomUUID()}`,
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
    }
  }

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
        id: `schedule:${c.moduleCode ?? idx}:${c.lessonType ?? ""}:${c.classNo ?? ""}`,
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

  return (
    <div className="min-h-screen flex bg-black text-white">
      {/* LEFT: CHAT */}
      <main className="flex-1 p-4 border-r border-white/10 flex flex-col">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">qwery-hub</h1>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10"
            onClick={() => setConnectOpen(true)}
          >
            Connect
          </button>
        </div>

        {/* Avatar/Image at the top */}
        <div className="flex-1 relative overflow-hidden mt-4">
          <Avatar isTalking={isAudioPlaying} />

          {/* Debug: Manual test button */}
          <button
            onClick={() => {
              console.log('🧪 Manual toggle: isAudioPlaying', !isAudioPlaying);
              setIsAudioPlaying(!isAudioPlaying);
            }}
            className="absolute bottom-4 right-4 px-3 py-1 bg-white/10 rounded text-xs hover:bg-white/20 z-50"
          >
            Test Avatar: {isAudioPlaying ? 'Talking' : 'Idle'}
          </button>
        </div>

        {/* Chat messages container */}
        <div className="h-[40vh] rounded-lg border border-white/10 p-3 overflow-auto space-y-3">
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

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
            placeholder="Ask your study buddy..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />

          <button
            className={`rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10 ${useTTS ? "bg-white/10" : ""
              }`}
            onClick={() => {
              const newState = !useTTS;
              console.log('🔊 TTS button clicked, new state:', newState);
              setUseTTS(newState);
            }}
            title="Enable text-to-speech"
            type="button"
          >
            {useTTS ? "🔊" : "🔇"}
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
      <aside className="w-80 p-4">
        <h2 className="text-lg font-semibold">Widgets</h2>
        <div className="mt-3 text-sm opacity-70">{syncStatus}</div>

        <div className="mt-4 space-y-3">
          {/* RIGHT NOW */}
          <div className="space-y-3 rounded-lg border border-white/10 p-3">
            <div className="font-medium">Right Now</div>
            <div className="text-xs opacity-70">
              canvas: {canvasTasks.filter((t) => !doneTaskIds.has(t.id)).length} • schedule:{" "}
              {scheduleTasks.filter((t) => !doneTaskIds.has(t.id)).length}
            </div>

            <div className="flex gap-2">
              <button
                onClick={promptRightNow}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
                disabled={loadingNext}
              >
                {loadingNext ? "..." : "Prompt"}
              </button>

              <button
                onClick={handleFinish}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40"
                disabled={!currentTask}
              >
                Finish
              </button>

              <button
                onClick={handleSkip}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40"
                disabled={!currentTask}
              >
                Skip
              </button>
            </div>

            <div className="text-sm text-white/80">
              {currentTask ? (
                <>
                  <div className="font-semibold">{currentTask.title}</div>
                  <div className="text-xs opacity-70">Source: {currentTask.source}</div>
                </>
              ) : (
                <div className="opacity-70">No recommendation yet. Sync then Prompt.</div>
              )}
            </div>
          </div>

          {/* SCHEDULE */}
          <div className="rounded-lg border border-white/10 p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Schedule</div>
              <button
                className="text-xs opacity-70 hover:opacity-100"
                onClick={() => refreshUpcomingClasses()}
              >
                {loadingSchedule ? "..." : "Refresh"}
              </button>
            </div>

            {!nusmodsShareLink ? (
              <div className="text-sm opacity-60 mt-2">Sync NUSMods first to see your classes.</div>
            ) : upcomingClasses?.[0]?.error ? (
              <div className="text-sm text-red-300 mt-2">{upcomingClasses[0].error}</div>
            ) : upcomingClasses.length === 0 ? (
              <div className="text-sm opacity-60 mt-2">No classes in the next 3 days 🎉</div>
            ) : (
              <div className="mt-2 space-y-2 text-sm">
                {upcomingClasses.map((c, idx) => (
                  <div key={idx} className="rounded-md border border-white/10 p-2">
                    <div className="font-semibold">
                      {c.moduleCode} {c.lessonType} ({c.classNo})
                    </div>
                    <div className="opacity-80">
                      {c.day} {c.startTime}–{c.endTime}
                    </div>
                    {c.venue && <div className="opacity-80">{c.venue}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* CONNECT MODAL */}
      {connectOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-black p-4">
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
                After syncing, click <span className="font-semibold">Prompt</span>. Finish marks tasks as done; Skip gives another task. If no Canvas tasks, you'll get a 30-min lecture study task.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
