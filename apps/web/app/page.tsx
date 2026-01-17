"use client";

<<<<<<< Updated upstream
import { pickNextTask, RightNowTask } from "../lib/rightNow";
import { useMemo, useState } from "react";
import { postJSON } from "@/lib/api";
import { parseNusmodsShareLink } from "@/lib/nusmods";

=======
import { useEffect, useMemo, useRef, useState } from "react";
import { postJSON } from "@/lib/api";
import { parseNusmodsShareLink } from "@/lib/nusmods";
import { pickNextTask, RightNowTask } from "@/lib/rightNow";
import { Avatar } from "./components/Avatar";
>>>>>>> Stashed changes

type Msg = { role: "user" | "assistant"; content: string };



export default function Home() {
  const [canvasTasks, setCanvasTasks] = useState<RightNowTask[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<RightNowTask[]>([]);

  const [currentTask, setCurrentTask] = useState<RightNowTask | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! I’m your study buddy. What are we doing today?" },
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



  async function handlePrompt() {
  setLoadingNext(true);

  // 1️⃣ Collect tasks
  const tasks = [...canvasTasks, ...scheduleTasks];

  if (tasks.length === 0) {
    setLoadingNext(false);
    return;
  }

  // 2️⃣ Auto-prompt the AI (no UI input)
  const aiPrompt = `
You are a productivity assistant.

Given the following tasks, choose EXACTLY ONE task the user should work on right now.

Rules:
- Choose the most urgent or important task
- Prefer tasks with deadlines
- Respond ONLY in JSON
- No explanation text

Tasks:
${JSON.stringify(tasks, null, 2)}

Return format:
{
  "id": string
}
`;

  try {
    const res = await postJSON<{ reply: string }>("/api/chat", {
      messages: [{ role: "system", content: aiPrompt }],
    });

    // 3️⃣ Parse AI response
    const parsed = JSON.parse(res.reply);
    const chosen = tasks.find((t) => t.id === parsed.id);

    // 4️⃣ Replace RIGHT NOW
    if (chosen) {
      setCurrentTask(chosen);
    }
  } catch (err) {
    console.error("Failed to get AI task", err);
  } finally {
    setLoadingNext(false);
  }
}



  async function handleFinish() {
    setCurrentTask(null);
    promptRightNow();
  }

  function handleSkip() {
    handlePrompt();
  }

<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes


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
        useTTS: useTTS,
      });

      // Add a natural pause before displaying the response (simulate thinking time)
      const minDelay = 800; // Minimum delay in ms
      const maxDelay = 1500; // Maximum delay in ms
      const delay = Math.min(minDelay + Math.random() * (maxDelay - minDelay), 2000);

      await new Promise(resolve => setTimeout(resolve, delay));

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);

      // Play audio if TTS is enabled and audioUrl is provided
      if (useTTS && data.audioUrl) {
        console.log('Playing TTS audio, URL length:', data.audioUrl.length);
        const audio = new Audio(data.audioUrl);

<<<<<<< Updated upstream
        audio.addEventListener('error', (e) => {
          console.error('Audio playback error:', e);
          console.error('Audio element error details:', audio.error);
        });

        audio.addEventListener('loadeddata', () => {
          console.log('Audio loaded successfully, duration:', audio.duration);
        });

        audio.play().catch((error) => {
          console.error("Error playing audio:", error);
          // Some browsers require user interaction for autoplay
          console.warn("If audio doesn't play, it may require user interaction. Try clicking the play button.");
        });
      } else if (useTTS && !data.audioUrl) {
        console.warn('TTS was requested but no audioUrl was returned');
=======
        // Track audio playback state for avatar animation
        audio.onplay = () => setIsAudioPlaying(true);
        audio.onended = () => setIsAudioPlaying(false);
        audio.onerror = () => setIsAudioPlaying(false);

        audio.play().catch(() => {
          setIsAudioPlaying(false);
        });
>>>>>>> Stashed changes
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
    } finally {
      setSending(false);
    }
  }
  async function promptRightNow() {
    if (sending) return;

    const userPrompt = "Which task should I work on right now?";

    // 1️⃣ Show the prompt in chat
    setMessages((m) => [...m, { role: "user", content: userPrompt }]);
    setSending(true);

    try {
      // 2️⃣ Ask the SAME AI assistant
      const data = await postJSON<{ reply: string }>("/api/chat", {
        message: userPrompt,
        canvasToken: canvasToken || undefined,
        nusmodsShareLink: nusmodsShareLink || undefined,
      });

      // 3️⃣ Show AI reply in chat
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);

      // 4️⃣ Extract task from reply
      const match = data.reply.match(/TASK:\s*(.+)/i);

      if (match) {
        setCurrentTask({
          id: crypto.randomUUID(),
          title: match[1],
          source: "Canvas", // or "Schedule" if you want later
        });
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${e.message}` },
      ]);
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
      const data = await postJSON<{ tasksCount: number; modulesCount: number }>(
        "/api/integrations/fetch-sync",
        { canvasToken, moduleCodes: codes, nusmodsShareLink }
      );

      setSyncStatus(
        `Synced ✅ Canvas tasks: ${data.tasksCount}, Modules: ${data.modulesCount}`
      );
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
      return;
    }

    setLoadingSchedule(true);
    try {
      const data = await postJSON<{ items: any[] }>("/api/schedule/upcoming", {
        nusmodsShareLink: link,
        semester: 2,
        days: 3,
      });
      setUpcomingClasses(data.items ?? []);
    } catch (e: any) {
      setUpcomingClasses([{ error: e.message ?? "Failed to load schedule" }]);
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
                  <div
                    className="h-full bg-white/60 rounded-full animate-pulse"
                    style={{
                      width: '60%'
                    }}
                  ></div>
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
      <aside className="w-80 p-4">
        <h2 className="text-lg font-semibold">Widgets</h2>
        <div className="mt-3 text-sm opacity-70">{syncStatus}</div>

        <div className="mt-4 space-y-3">
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={promptRightNow}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                Prompt
              </button>

              <button
                onClick={handleFinish}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                disabled={!currentTask}
              >
                Finish
              </button>

              <button
                onClick={handleSkip}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                disabled={!currentTask}
              >
                Skip
              </button>
            </div>

            <div className="text-sm text-white/80">
              {currentTask ? (
                <>
                  <div className="font-semibold">{currentTask.title}</div>
                  <div className="text-xs opacity-70">
                    Source: {currentTask.source}
                  </div>
                </>
              ) : (
                "RIGHT NOW"
              )}
            </div>
          </div>


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
              <div className="text-sm opacity-60 mt-2">
                Sync NUSMods first to see your classes.
              </div>
            ) : upcomingClasses?.[0]?.error ? (
              <div className="text-sm text-red-300 mt-2">
                {upcomingClasses[0].error}
              </div>
            ) : upcomingClasses.length === 0 ? (
              <div className="text-sm opacity-60 mt-2">
                No classes in the next 3 days 🎉
              </div>
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


      {/* CONNECT MODAL: Added z-[100] to be on top of EVERYTHING */}
      {connectOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[100]">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-black p-4 relative z-[110]">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Connect data sources</div>
              <button onClick={() => setConnectOpen(false)} className="hover:text-white/70">✕</button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-sm opacity-70">Canvas token</div>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/30"
                  value={canvasToken}
                  onChange={(e) => setCanvasToken(e.target.value)}
                  placeholder="Paste your token here"
                />
              </label>

              <label className="block">
                <div className="text-sm opacity-70">NUSMods Share/Sync link</div>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/30"
                  placeholder="Paste your NUSMods Share/Sync link here"
                  value={nusmodsShareLink}
                  onChange={(e) => setNusmodsShareLink(e.target.value)}
                />
              </label>


              <div className="flex justify-end gap-2 pt-2">
<<<<<<< Updated upstream
                <button onClick={() => setConnectOpen(false)}>Cancel</button>
                <button onClick={sync}>Sync</button>
=======
                <button
                  className="px-4 py-2 hover:opacity-70 transition-opacity"
                  onClick={() => setConnectOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded bg-white/10 px-4 py-2 hover:bg-white/20 transition-colors border border-white/10"
                  onClick={sync}
                >
                  Sync
                </button>
              </div>

              <div className="text-xs opacity-60 pt-2 border-t border-white/5 mt-2">
                After syncing, click <span className="font-semibold text-white">Prompt</span>. Finish marks tasks as done; Skip gives another task.
>>>>>>> Stashed changes
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
