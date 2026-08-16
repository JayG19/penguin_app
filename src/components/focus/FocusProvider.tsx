"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Square, Timer } from "lucide-react";
import { toast } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface FocusTarget {
  label: string;
  minutes: number;
  courseId?: string | null;
  assignmentId?: string | null;
}

interface FocusState extends FocusTarget {
  secondsLeft: number;
  running: boolean;
  startedAtMs: number;
}

interface FocusContextValue {
  session: FocusState | null;
  start: (target: FocusTarget) => void;
  pause: () => void;
  resume: () => void;
  finish: (skip?: boolean) => void;
}

const Ctx = createContext<FocusContextValue | null>(null);

export function useFocus() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFocus outside FocusProvider");
  return ctx;
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FocusState | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const record = useCallback(async (state: FocusState, completed: boolean) => {
    const elapsedMins = Math.max(1, Math.round((state.minutes * 60 - state.secondsLeft) / 60));
    await fetch("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: state.label,
        mode: String(state.minutes),
        minutes: completed ? state.minutes : elapsedMins,
        courseId: state.courseId ?? null,
        assignmentId: state.assignmentId ?? null,
        completed,
      }),
    }).catch(() => {});
  }, []);

  const finish = useCallback(
    (skip = false) => {
      const s = sessionRef.current;
      if (!s) return;
      setSession(null);
      if (!skip) {
        record(s, s.secondsLeft <= 0);
        toast(s.secondsLeft <= 0 ? "Focus session complete — study time recorded 🎉" : "Focus session saved");
      }
    },
    [record],
  );

  useEffect(() => {
    if (!session?.running) return;
    const t = setInterval(() => {
      setSession((prev) => {
        if (!prev || !prev.running) return prev;
        const next = prev.secondsLeft - 1;
        if (next <= 0) {
          return { ...prev, secondsLeft: 0, running: false };
        }
        return { ...prev, secondsLeft: next };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [session?.running]);

  useEffect(() => {
    if (session && session.secondsLeft === 0 && !session.running) {
      // timer hit zero naturally
      record(session, true);
      toast("Focus session complete — study time recorded 🎉");
      setSession(null);
    }
  }, [session, record]);

  const start = useCallback((target: FocusTarget) => {
    setSession({
      ...target,
      secondsLeft: target.minutes * 60,
      running: true,
      startedAtMs: Date.now(),
    });
    toast(`Focus session started: ${target.label}`);
  }, []);

  const pause = useCallback(() => setSession((s) => (s ? { ...s, running: false } : s)), []);
  const resume = useCallback(() => setSession((s) => (s && s.secondsLeft > 0 ? { ...s, running: true } : s)), []);

  // Allow non-React triggers (command palette, drawers) via a window event.
  useEffect(() => {
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent<FocusTarget>).detail;
      if (detail?.label) start({ ...detail, minutes: detail.minutes ?? 25 });
    };
    window.addEventListener("focus:start", onStart);
    return () => window.removeEventListener("focus:start", onStart);
  }, [start]);

  return (
    <Ctx.Provider value={{ session, start, pause, resume, finish }}>
      {children}
      {session && <FocusMiniBar />}
    </Ctx.Provider>
  );
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function FocusMiniBar() {
  const { session, pause, resume, finish } = useFocus();
  if (!session) return null;
  const pct = 100 - (session.secondsLeft / (session.minutes * 60)) * 100;
  return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 z-40 rounded-xl border border-border-base bg-surface shadow-xl px-3.5 py-2.5 flex items-center gap-3 max-w-[calc(100vw-2rem)]">
      <Timer size={16} className="text-accent shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate max-w-40">{session.label}</p>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-sm tabular-nums", session.running ? "text-foreground" : "text-muted")}>
            {fmt(session.secondsLeft)}
          </span>
          <div className="h-1 w-16 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {session.running ? (
          <button onClick={pause} className="p-1.5 rounded-md hover:bg-surface-2 text-muted" aria-label="Pause">
            <Pause size={14} />
          </button>
        ) : (
          <button onClick={resume} className="p-1.5 rounded-md hover:bg-surface-2 text-muted" aria-label="Resume">
            <Play size={14} />
          </button>
        )}
        <button onClick={() => finish()} className="p-1.5 rounded-md hover:bg-surface-2 text-muted" aria-label="Finish session">
          <Square size={14} />
        </button>
      </div>
    </div>
  );
}
