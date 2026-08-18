"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlarmClock, Bell, Check, ChevronRight, X } from "lucide-react";
import { Button, toast } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

export interface NudgeDTO {
  id: string;
  title: string;
  body: string | null;
  remindAt: string;
  kind: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  snoozedUntil: string | null;
}

interface NudgeContextValue {
  due: NudgeDTO[];
  scheduled: NudgeDTO[];
  refresh: () => Promise<void>;
  snooze: (id: string, minutes: number) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

const Ctx = createContext<NudgeContextValue | null>(null);

export function useNudges() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNudges outside NudgeProvider");
  return ctx;
}

const POLL_MS = 60_000;

export function NudgeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [due, setDue] = useState<NudgeDTO[]>([]);
  const [scheduled, setScheduled] = useState<NudgeDTO[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/nudges");
      if (!res.ok) return;
      const data = await res.json();
      setDue(data.due ?? []);
      setScheduled(data.scheduled ?? []);
    } catch {}
  }, []);

  // Rescan derives fresh automatic nudges from current deadlines, then reloads.
  const scanAndRefresh = useCallback(async () => {
    try {
      await fetch("/api/nudges/scan", { method: "POST" });
    } catch {}
    await refresh();
  }, [refresh]);

  useEffect(() => {
    scanAndRefresh();
    const t = setInterval(scanAndRefresh, POLL_MS);
    const onChanged = () => scanAndRefresh();
    window.addEventListener("nudges:changed", onChanged);
    return () => {
      clearInterval(t);
      window.removeEventListener("nudges:changed", onChanged);
    };
  }, [scanAndRefresh]);

  const snooze = useCallback(async (id: string, minutes: number) => {
    setDue((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/nudges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snoozeMinutes: minutes }),
    });
    toast(minutes >= 1440 ? "Snoozed until tomorrow" : `Snoozed for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}`);
    refresh();
  }, [refresh]);

  const dismiss = useCallback(async (id: string) => {
    setDue((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/nudges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ due, scheduled, refresh, snooze, dismiss }}>
      {children}
      <NudgeStack onOpen={(n) => router.push(nudgeHref(n))} />
    </Ctx.Provider>
  );
}

export function nudgeHref(n: NudgeDTO): string {
  switch (n.entityType) {
    case "assignment": return `/assignments?open=${n.entityId}`;
    case "quiz": return `/quizzes?open=${n.entityId}`;
    case "announcement": return `/announcements?open=${n.entityId}`;
    case "grade": return `/courses`;
    case "task": return `/dashboard`;
    default: return "/dashboard";
  }
}

/** Bottom-right stack of nudges that have come due. */
function NudgeStack({ onOpen }: { onOpen: (n: NudgeDTO) => void }) {
  const { due, snooze, dismiss } = useNudges();
  const [collapsed, setCollapsed] = useState(false);
  if (due.length === 0) return null;

  const visible = collapsed ? [] : due.slice(0, 2);
  const hidden = due.length - visible.length;

  return (
    <div className="fixed bottom-16 lg:bottom-5 right-4 lg:right-20 z-40 flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))]" role="region" aria-label="Nudges">
      {visible.map((n) => (
        <div key={n.id} className="rounded-xl border border-border-base bg-surface shadow-xl p-3 animate-in">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <AlarmClock size={13} />
            </span>
            <div className="min-w-0 grow">
              <p className="text-[13px] font-medium leading-snug">{n.title}</p>
              {n.body && <p className="text-xs text-muted mt-0.5">{n.body}</p>}
              <p className="text-[10px] text-faint mt-0.5">{timeAgo(n.remindAt)}</p>
            </div>
            <button onClick={() => dismiss(n.id)} className="text-faint hover:text-foreground p-0.5" aria-label="Dismiss nudge">
              <X size={13} />
            </button>
          </div>
          <div className="flex gap-1.5 mt-2.5 pl-8.5 flex-wrap">
            {n.entityType && (
              <Button size="xs" variant="primary" onClick={() => { onOpen(n); dismiss(n.id); }}>
                Open <ChevronRight size={11} />
              </Button>
            )}
            <Button size="xs" variant="outline" onClick={() => snooze(n.id, 60)}>1h</Button>
            <Button size="xs" variant="outline" onClick={() => snooze(n.id, 1440)}>Tomorrow</Button>
            <Button size="xs" variant="ghost" onClick={() => dismiss(n.id)}>
              <Check size={11} /> Got it
            </Button>
          </div>
        </div>
      ))}
      {(hidden > 0 || collapsed) && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "self-end rounded-full border border-border-base bg-surface px-3 py-1.5 text-xs font-medium shadow-lg",
            "flex items-center gap-1.5 hover:border-border-strong",
          )}
        >
          <Bell size={12} className="text-accent" />
          {collapsed ? `${due.length} nudge${due.length > 1 ? "s" : ""}` : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}
