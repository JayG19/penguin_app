"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { format, isToday } from "date-fns";
import { Check, ChevronDown, ChevronUp, RefreshCw, Send, Sparkles } from "lucide-react";
import { Button, Input, Spinner, toast } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import type { WidgetCtx } from "./DashboardClient";

/**
 * The single "what is happening today" band at the top of the dashboard:
 * greeting, live clock, the day's counts, quick capture, today's schedule and
 * sync status — replacing what used to be four separate cards.
 */
export function HeroToday({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState("Welcome back");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      const h = d.getHours();
      setGreeting(h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const inCourse = <T extends { courseId?: string | null }>(x: T) => !courseFilter || x.courseId === courseFilter;
  const open = (s: string) => !["completed", "submitted"].includes(s);

  const dueToday = data.assignments.filter((a) => a.dueAt && isToday(new Date(a.dueAt)) && open(a.status) && inCourse(a));
  const tasksToday = data.tasks.filter((t) => t.dueAt && isToday(new Date(t.dueAt)) && !t.completed && inCourse(t));
  const quizzesToday = data.quizzes.filter((q) => q.startAt && isToday(new Date(q.startAt)) && q.status === "upcoming" && inCourse(q));
  const todayEvents = data.events.filter((e) => isToday(new Date(e.startAt)) && inCourse(e));

  const week = 7 * 864e5;
  const dueThisWeek =
    data.assignments.filter((a) => a.dueAt && new Date(a.dueAt) > now && new Date(a.dueAt).getTime() - now.getTime() < week && open(a.status) && inCourse(a)).length +
    data.tasks.filter((t) => t.dueAt && new Date(t.dueAt) > now && new Date(t.dueAt).getTime() - now.getTime() < week && !t.completed && inCourse(t)).length;
  const upcomingExams = data.quizzes.filter((q) => q.startAt && new Date(q.startAt) > now && q.status === "upcoming" && inCourse(q)).length;
  const unread = data.announcements.filter((a) => !a.read && inCourse(a)).length;

  type Row = { time: Date; label: string; sub: string; kind: string; onOpen?: () => void; onComplete?: () => Promise<void> };
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [
      ...todayEvents.map((e) => ({
        time: new Date(e.startAt),
        label: e.title,
        sub: [e.course?.code, e.location].filter(Boolean).join(" · ") || "Event",
        kind: e.type === "class" ? "class" : "event",
      })),
      ...dueToday.map((a) => ({
        time: new Date(a.dueAt!),
        label: a.title,
        sub: `${a.course.code}${a.weight != null ? ` · ${a.weight}%` : ""} · due today`,
        kind: "assignment",
        onOpen: () => ctx.openAssignment(a),
        onComplete: async () => {
          await fetch(`/api/assignments/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
          toast("Marked complete 🎉");
          router.refresh();
        },
      })),
      ...quizzesToday.map((q) => ({
        time: new Date(q.startAt!),
        label: q.title,
        sub: [q.course.code, q.weight ? `${q.weight}%` : null, q.location].filter(Boolean).join(" · "),
        kind: "quiz",
        onOpen: () => ctx.openQuiz(q),
      })),
      ...tasksToday.map((t) => ({
        time: new Date(t.dueAt!),
        label: t.title,
        sub: t.course?.code ?? "Personal",
        kind: "task",
        onComplete: async () => {
          await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) });
          toast("Task done ✓");
          router.refresh();
        },
      })),
    ];
    return list.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [todayEvents, dueToday, quizzesToday, tasksToday, ctx, router]);

  const KIND_DOT: Record<string, string> = {
    class: "bg-sky-500", assignment: "bg-amber-500", quiz: "bg-rose-500", task: "bg-emerald-500", event: "bg-violet-500",
  };

  const stats = [
    { n: dueToday.length + tasksToday.length + quizzesToday.length, label: "due today" },
    { n: dueThisWeek, label: "this week" },
    { n: upcomingExams, label: "assessments" },
    { n: unread, label: "unread" },
  ];

  return (
    <section
      aria-label="Today"
      className="relative overflow-hidden rounded-2xl border border-border-base bg-surface"
    >
      {/* accent wash keeps the hero visually distinct from the widget grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent)" }}
      />
      <div className="relative p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" suppressHydrationWarning>
              {greeting}, {data.userName.split(" ")[0]}
            </h1>
            <p className="text-[13px] text-muted mt-0.5 tabular-nums" suppressHydrationWarning>
              {format(now, "EEEE, MMMM d")} · {format(now, "h:mm a")}
              {data.courses[0]?.term ? ` · ${data.courses[0].term}` : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {stats.map((s) => (
              <div
                key={s.label}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-center min-w-[4.5rem]",
                  s.n > 0 ? "border-border-strong bg-surface-2" : "border-border-base",
                )}
              >
                <p className={cn("text-lg font-semibold tabular-nums leading-tight", s.n > 0 ? "text-foreground" : "text-faint")}>{s.n}</p>
                <p className="text-[10px] text-muted uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <QuickCaptureBar />

        <div className="mt-3 rounded-xl border border-border-base bg-surface-2/40">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left"
            aria-expanded={expanded}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted grow">
              Today&apos;s schedule {rows.length > 0 && <span className="text-faint">({rows.length})</span>}
            </span>
            {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
          </button>
          {expanded && (
            <div className="divide-y divide-border-base border-t border-border-base">
              {rows.length === 0 ? (
                <div className="px-3.5 py-5 text-center">
                  <p className="text-[13px] font-medium">Nothing scheduled today</p>
                  <p className="text-xs text-muted mt-0.5">You&apos;re all caught up 🎉 A good day to get ahead.</p>
                  <Button
                    size="xs"
                    variant="outline"
                    className="mt-2"
                    onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "task" } }))}
                  >
                    Add a task
                  </Button>
                </div>
              ) : (
                rows.map((r, i) => (
                  <div key={i} className="group flex items-center gap-3 px-3.5 py-2">
                    <span className="w-16 shrink-0 text-[12px] text-muted tabular-nums">{format(r.time, "h:mm a")}</span>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", KIND_DOT[r.kind])} aria-hidden />
                    <button onClick={r.onOpen} disabled={!r.onOpen} className={cn("min-w-0 grow text-left", r.onOpen && "hover:text-accent")}>
                      <p className="text-[13px] font-medium truncate">{r.label}</p>
                      <p className="text-xs text-muted truncate">{r.sub}</p>
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {r.onOpen && <Button size="xs" variant="outline" onClick={r.onOpen}>Open</Button>}
                      {r.onComplete && (
                        <Button size="xs" variant="outline" onClick={r.onComplete} aria-label={`Mark ${r.label} done`}>
                          <Check size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <SyncLine ctx={ctx} />
      </div>
    </section>
  );
}

function QuickCaptureBar() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ title: string; dueAt: string | null; course: { id: string; code: string } | null } | null>(null);
  const [busy, setBusy] = useState(false);

  async function parse() {
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch("/api/quick-capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (res.ok) setPreview(await res.json());
    setBusy(false);
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: preview.title, dueAt: preview.dueAt, courseId: preview.course?.id ?? null }),
    });
    toast("Task created");
    setText("");
    setPreview(null);
    setBusy(false);
    router.refresh();
    window.dispatchEvent(new CustomEvent("nudges:changed"));
  }

  return (
    <div className="mt-3.5">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); parse(); }}>
        <div className="relative grow">
          <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); setPreview(null); }}
            placeholder="Add anything — “finish analytics assignment tomorrow at 7pm”"
            className="pl-9"
            aria-label="Quick capture"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy || !text.trim()} aria-label="Parse">
          <Send size={14} />
        </Button>
      </form>
      {preview && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border-base bg-surface-2 px-3 py-2">
          <span className="text-[13px] font-medium">{preview.title}</span>
          <span className="text-xs text-muted">
            {preview.dueAt ? format(new Date(preview.dueAt), "MMM d, h:mm a") : "no date detected"}
            {preview.course ? ` · ${preview.course.code}` : ""}
          </span>
          <span className="grow" />
          <Button size="xs" variant="primary" onClick={confirm} disabled={busy}>Save</Button>
          <Button size="xs" variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
        </div>
      )}
    </div>
  );
}

function SyncLine({ ctx }: { ctx: WidgetCtx }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const log = ctx.data.lastSync;

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const r = await res.json();
      toast(r.status === "success" ? `Sync complete: +${r.added} added, ${r.updated} updated` : "Sync failed", r.status === "success" ? "default" : "error");
      router.refresh();
      window.dispatchEvent(new CustomEvent("nudges:changed"));
    } catch {
      toast("Sync failed", "error");
    }
    setSyncing(false);
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-muted">
      <span className={cn("h-1.5 w-1.5 rounded-full", log?.status === "error" ? "bg-rose-500" : log && !log.finishedAt ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
      <span>
        Brightspace ·{" "}
        {!log
          ? "never synced"
          : log.finishedAt
            ? `synced ${timeAgo(log.finishedAt)}`
            : "syncing…"}
        {log?.finishedAt && (log.added > 0 || log.updated > 0)
          ? ` · +${log.added} added, ${log.updated} updated`
          : ""}
      </span>
      <button
        onClick={syncNow}
        disabled={syncing}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border-base px-2.5 py-1 font-medium text-foreground hover:border-border-strong disabled:opacity-50"
      >
        {syncing ? <Spinner className="h-3 w-3" /> : <RefreshCw size={11} />}
        {syncing ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
