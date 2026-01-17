"use client";

import { useMemo, useState } from "react";
import { postJSON } from "@/lib/api";
import { parseNusmodsShareLink } from "@/lib/nusmods";
import { pickNextTask, RightNowTask } from "@/lib/rightNow";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
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

  // ===== Connect/Sync =====
  const [connectOpen, setConnectOpen] = useState(false);
  const [canvasToken, setCanvasToken] = useState("");
  const [nusmodsShareLink, setNusmodsShareLink] = useState("");
  const [syncStatus, setSyncStatus] = useState("Not connected");

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  // ===== Schedule widget =====
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // ===== Right Now =====
  const [loadingNext, setLoadingNext] = useState(false);

  // ---------------------------
  // Fallback: if no Canvas assignments, study 30 min for a lecture module
  // ---------------------------
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
      dueAtMs: startAtMs,
      importance: 3,
      estimatedHours: 0.5,
      difficulty: 2,
    };
  }

  // ---------------------------
  // Choose next task deterministically with done/skip filtering + fallback
  // ---------------------------
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

    return pickNextTask(canvas2, sched2, { energy: 3 });
  }

  // ---------------------------
  // Right Now: Prompt / Finish / Skip
  // ---------------------------
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


  // ---------------------------
  // Chat send
  // ---------------------------
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
        const audio = new Audio(data.audioUrl);
        audio.play().catch(() => {});
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setSending(false);
    }
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
        source: "canvas",
        dueAtMs: a.dueDate ? new Date(a.dueDate).getTime() : undefined,
        importance: 3,
        estimatedHours: 1,
        difficulty: 3,
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
        id: `schedule:${c.moduleCode ?? idx}:${c.lessonType ?? ""}:${c.classNo ?? ""}`,
        title: `Prep: ${c.moduleCode} ${c.lessonType} (${c.classNo})`,
        source: "schedule",
        dueAtMs: c.startAtMs ?? undefined,
        importance: 2,
        estimatedHours: 0.5,
        difficulty: 2,
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
    <div className="min-h-screen flex bg-black text-white">
      {/* LEFT: CHAT */}
      <main className="flex-1 p-4 border-r border-white/10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">qwery-hub</h1>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10"
            onClick={() => setConnectOpen(true)}
          >
            Connect
          </button>
        </div>

        <div className="mt-4 h-[70vh] rounded-lg border border-white/10 p-3 overflow-auto space-y-3">
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
            className={`rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10 ${
              useTTS ? "bg-white/10" : ""
            }`}
            onClick={() => setUseTTS(!useTTS)}
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
      <aside className="w-96 p-6 flex flex-col gap-6 bg-[#0a0a0a]">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Activity</h2>
          <div className="mt-1 flex items-center gap-2 text-xs">
             <span className={`h-2 w-2 rounded-full ${syncStatus.includes('✅') ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
             <span className="opacity-60">{syncStatus}</span>
          </div>
        </div>

        <div className="space-y-6 overflow-auto pr-2 custom-scrollbar">
          {/* RIGHT NOW FOCUS CARD */}
          <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">Current Focus</span>
              <div className="flex gap-1">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                  {canvasTasks.filter((t) => !doneTaskIds.has(t.id)).length} Left
                </span>
              </div>
            </div>

            {currentTask ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold leading-tight text-white">{currentTask.title}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">
                      {currentTask.source}
                    </span>
                    {currentTask.dueAtMs && (
                      <span className="text-[10px] text-orange-400">
                         Due Soon
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleFinish}
                    className="flex-1 rounded-xl bg-white text-black py-2.5 text-sm font-bold hover:bg-white/90 transition-all active:scale-95"
                  >
                    Complete
                  </button>
                  <button
                    onClick={handleSkip}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition-all"
                    title="Skip Task"
                  >
                    ⏭️
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-white/40 mb-4">Ready to start your session?</p>
                <button
                  onClick={promptRightNow}
                  disabled={loadingNext}
                  className="w-full rounded-xl border border-dashed border-white/20 py-4 text-sm font-medium hover:bg-white/5 hover:border-white/40 transition-all"
                >
                  {loadingNext ? "Finding best task..." : "+ Get Next Task"}
                </button>
              </div>
            )}
          </section>

          {/* SCHEDULE SECTION */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Schedule</h3>
              <button
                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                onClick={() => refreshUpcomingClasses()}
              >
                {loadingSchedule ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>

            <div className="space-y-3">
              {!nusmodsShareLink ? (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs opacity-40">
                  Connect NUSMods to view schedule
                </div>
              ) : upcomingClasses.length === 0 ? (
                <div className="rounded-xl bg-green-500/5 border border-green-500/10 p-4 text-center">
                   <p className="text-sm text-green-400 font-medium">Clear Schedule! 🎉</p>
                </div>
              ) : (
                upcomingClasses.map((c, idx) => (
                  <div 
                    key={idx} 
                    className="group relative flex gap-4 rounded-xl border border-white/[0.03] bg-white/[0.02] p-3 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center border-r border-white/10 pr-3 min-w-[50px]">
                       <span className="text-[10px] font-bold uppercase text-white/40">{c.day?.substring(0,3)}</span>
                       <span className="text-sm font-bold">{c.startTime?.split(':')[0]}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold group-hover:text-blue-400 transition-colors">
                        {c.moduleCode}
                      </div>
                      <div className="text-[11px] text-white/50 leading-tight mt-0.5">
                        {c.lessonType} • {c.venue || "No Venue"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
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
                After syncing, click <span className="font-semibold">Prompt</span>. Finish marks tasks as done; Skip gives another task. If no Canvas tasks, you’ll get a 30-min lecture study task.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
