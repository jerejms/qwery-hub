"use client";

import { pickNextTask, RightNowTask } from "../lib/rightNow";
import { useMemo, useState } from "react";
import { postJSON } from "@/lib/api";
import { parseNusmodsShareLink } from "@/lib/nusmods";


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

  const [connectOpen, setConnectOpen] = useState(false);
  const [canvasToken, setCanvasToken] = useState("");
  const [nusmodsShareLink, setNusmodsShareLink] = useState("");
  const [syncStatus, setSyncStatus] = useState("Not connected");

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const [nextClass, setNextClass] = useState<any>(null);
  const [loadingNext, setLoadingNext] = useState(false);


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



  async function send() {
    if (!canSend) return;

    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);

    try {
      const data = await postJSON<{ reply: string }>("/api/chat", { 
        message: text,
        canvasToken: canvasToken || undefined,
        nusmodsShareLink: nusmodsShareLink || undefined,
      });
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
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
      await refreshNextClass(nusmodsShareLink);
      setConnectOpen(false);
    } catch (e: any) {
      setSyncStatus(`Sync failed ❌ ${e.message}`);
    }
  }
  async function refreshNextClass(linkOverride?: string) {
    const link = linkOverride ?? nusmodsShareLink;
    if (!link) {
      setNextClass(null);
      return;
    }

    setLoadingNext(true);
    try {
      const data = await postJSON<{ next: any }>("/api/schedule/next", {
        nusmodsShareLink: link,
        semester: 2,
      });
      setNextClass(data.next ?? null);
    } catch (e: any) {
      setNextClass({ error: e.message ?? "Failed to load next class" });
    } finally {
      setLoadingNext(false);
    }
  }
  

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
                onClick={() => refreshNextClass()}
              >
                {loadingNext ? "..." : "Refresh"}
              </button>
            </div>

            {!nusmodsShareLink ? (
              <div className="text-sm opacity-60 mt-2">
                Sync NUSMods first to see your next class.
              </div>
            ) : nextClass?.error ? (
              <div className="text-sm text-red-300 mt-2">
                {nextClass.error}
              </div>
            ) : !nextClass ? (
              <div className="text-sm opacity-60 mt-2">
                No upcoming classes 🎉
              </div>
            ) : (
              <div className="mt-2 text-sm">
                <div className="font-semibold">
                  {nextClass.moduleCode} {nextClass.lessonType} ({nextClass.classNo})
                </div>
                <div className="opacity-80">
                  {nextClass.day} {nextClass.startTime}–{nextClass.endTime}
                </div>
                {nextClass.venue && <div className="opacity-80">{nextClass.venue}</div>}
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
                <button onClick={sync}>Sync</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
