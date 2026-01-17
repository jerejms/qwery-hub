"use client";

import { useMemo, useState } from "react";
import { postJSON } from "@/lib/api";
import { parseNusmodsShareLink } from "@/lib/nusmods";


type Msg = { role: "user" | "assistant"; content: string };


export default function Home() {
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

  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);



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
          <div className="rounded-lg border border-white/10 p-3">
            <div className="font-medium">Right Now</div>
            <div className="text-sm opacity-60">
              Shows what to do next (Canvas + Schedule)
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
