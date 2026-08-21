"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { format, isToday } from "date-fns";
import { Check, ChevronDown, ChevronUp, RefreshCw, Send, Sparkles } from "lucide-react";
import { Button, Input, Spinner, toast } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { parseQuickCapture, type CaptureKind } from "@/lib/quickcapture";
import type { CourseLite } from "@/components/types";
import type { WidgetCtx } from "./DashboardClient";

/**
 * The single "what is happening today" band at the top of the dashboard:
 * greeting, live clock, the day's counts, quick capture, today's schedule and
 * sync status — replacing what used to be four separate cards.
 */
type StatKey = "today" | "week" | "assessments" | "unread";

export function HeroToday({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [greeting, setGreeting] = useState("Welcome back");
  const [expanded, setExpanded] = useState(true);
  const [activeStat, setActiveStat] = useState<StatKey>("today");

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
  const dueThisWeekAssignments = data.assignments.filter((a) => a.dueAt && new Date(a.dueAt) > now && new Date(a.dueAt).getTime() - now.getTime() < week && open(a.status) && inCourse(a));
  const dueThisWeekTasks = data.tasks.filter((t) => t.dueAt && new Date(t.dueAt) > now && new Date(t.dueAt).getTime() - now.getTime() < week && !t.completed && inCourse(t));
  const upcomingAssessments = data.quizzes.filter((q) => q.startAt && new Date(q.startAt) > now && q.status === "upcoming" && inCourse(q));
  const unreadAnnouncements = data.announcements.filter((a) => !a.read && inCourse(a));

  type Row = { time: Date; label: string; sub: string; kind: string; onOpen?: () => void; onComplete?: () => Promise<void> };

  const rowsByStat = useMemo<Record<StatKey, Row[]>>(() => {
    const assignmentRow = (a: (typeof dueToday)[number], suffix: string): Row => ({
      time: new Date(a.dueAt!),
      label: a.title,
      sub: `${a.course.code}${a.weight != null ? ` · ${a.weight}%` : ""}${suffix}`,
      kind: "assignment",
      onOpen: () => ctx.openAssignment(a),
      onComplete: async () => {
        await fetch(`/api/assignments/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
        toast("Marked complete 🎉");
        router.refresh();
      },
    });
    const taskRow = (t: (typeof tasksToday)[number]): Row => ({
      time: new Date(t.dueAt!),
      label: t.title,
      sub: t.course?.code ?? "Personal",
      kind: "task",
      onComplete: async () => {
        await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) });
        toast("Task done ✓");
        router.refresh();
      },
    });
    const quizRow = (q: (typeof quizzesToday)[number]): Row => ({
      time: new Date(q.startAt!),
      label: q.title,
      sub: [q.course.code, q.weight ? `${q.weight}%` : null, q.location].filter(Boolean).join(" · "),
      kind: "quiz",
      onOpen: () => ctx.openQuiz(q),
    });

    const today: Row[] = [
      ...todayEvents.map((e) => ({
        time: new Date(e.startAt),
        label: e.title,
        sub: [e.course?.code, e.location].filter(Boolean).join(" · ") || "Event",
        kind: e.type === "class" ? "class" : "event",
      })),
      ...dueToday.map((a) => assignmentRow(a, " · due today")),
      ...quizzesToday.map(quizRow),
      ...tasksToday.map(taskRow),
    ];
    const weekRows: Row[] = [
      ...dueThisWeekAssignments.map((a) => assignmentRow(a, ` · ${format(new Date(a.dueAt!), "EEE")}`)),
      ...dueThisWeekTasks.map(taskRow),
    ];
    const assessmentRows: Row[] = upcomingAssessments.map(quizRow);
    const unreadRows: Row[] = unreadAnnouncements.map((an) => ({
      time: new Date(an.postedAt),
      label: an.title,
      sub: [an.course.code, an.author].filter(Boolean).join(" · "),
      kind: "announcement",
      onOpen: () => router.push("/announcements"),
      onComplete: async () => {
        await fetch(`/api/announcements/${an.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) });
        toast("Marked as read");
        router.refresh();
      },
    }));

    return {
      today: today.sort((a, b) => a.time.getTime() - b.time.getTime()),
      week: weekRows.sort((a, b) => a.time.getTime() - b.time.getTime()),
      assessments: assessmentRows.sort((a, b) => a.time.getTime() - b.time.getTime()),
      unread: unreadRows.sort((a, b) => b.time.getTime() - a.time.getTime()),
    };
  }, [todayEvents, dueToday, quizzesToday, tasksToday, dueThisWeekAssignments, dueThisWeekTasks, upcomingAssessments, unreadAnnouncements, ctx, router]);

  const rows = rowsByStat[activeStat];

  const KIND_DOT: Record<string, string> = {
    class: "bg-sky-500", assignment: "bg-amber-500", quiz: "bg-rose-500", task: "bg-emerald-500", event: "bg-violet-500", announcement: "bg-indigo-500",
  };

  const STAT_META: Record<StatKey, { label: string; heading: string; empty: string }> = {
    today: { label: "due today", heading: "Today's schedule", empty: "Nothing scheduled today" },
    week: { label: "this week", heading: "Due this week", empty: "Nothing due this week" },
    assessments: { label: "assessments", heading: "Upcoming assessments", empty: "No upcoming quizzes or exams" },
    unread: { label: "unread", heading: "Unread announcements", empty: "You're all caught up on announcements" },
  };

  const stats: { key: StatKey; n: number }[] = [
    { key: "today", n: dueToday.length + tasksToday.length + quizzesToday.length },
    { key: "week", n: dueThisWeekAssignments.length + dueThisWeekTasks.length },
    { key: "assessments", n: upcomingAssessments.length },
    { key: "unread", n: unreadAnnouncements.length },
  ];

  return (
    <section aria-label="Today" className="dashboard-panel relative overflow-hidden rounded-2xl border border-border-base bg-surface">
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
            {stats.map((s) => {
              const meta = STAT_META[s.key];
              const active = activeStat === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => { setActiveStat(s.key); setExpanded(true); }}
                  aria-pressed={active}
                  title={`Show ${meta.heading.toLowerCase()}`}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-center min-w-[4.5rem] transition-colors cursor-pointer",
                    active
                      ? "border-accent bg-accent-soft"
                      : s.n > 0
                        ? "border-border-strong bg-surface-2 hover:border-accent/60"
                        : "border-border-base hover:border-border-strong",
                  )}
                >
                  <p className={cn("text-lg font-semibold tabular-nums leading-tight", active ? "text-accent" : s.n > 0 ? "text-foreground" : "text-faint")}>{s.n}</p>
                  <p className={cn("text-[10px] uppercase tracking-wide", active ? "text-accent" : "text-muted")}>{meta.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <QuickCaptureBar courses={data.courses} />

        <div className="mt-3 rounded-xl border border-border-base bg-surface-2/40">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left"
            aria-expanded={expanded}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted grow">
              {STAT_META[activeStat].heading} {rows.length > 0 && <span className="text-faint">({rows.length})</span>}
            </span>
            {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
          </button>
          {expanded && (
            <div className="divide-y divide-border-base border-t border-border-base">
              {rows.length === 0 ? (
                <div className="px-3.5 py-5 text-center">
                  <p className="text-[13px] font-medium">{STAT_META[activeStat].empty}</p>
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

const KIND_LABEL: Record<CaptureKind, string> = {
  assignment: "Assignment", quiz: "Quiz", exam: "Exam", event: "Event", task: "Task",
  reading: "Reading", project: "Project", presentation: "Presentation", reminder: "Reminder",
};
/** Kinds that need a matched course to save (assignments/quizzes/exams live under a course). */
const NEEDS_COURSE: CaptureKind[] = ["assignment", "quiz", "exam"];

function matchCourse(courseHint: string | null, title: string, courses: CourseLite[]): CourseLite | null {
  if (courseHint) {
    const hint = courseHint.replace(/\s/g, "").toUpperCase();
    const byCode = courses.find((c) => c.code.replace(/\s/g, "").toUpperCase() === hint);
    if (byCode) return byCode;
  }
  const lower = title.toLowerCase();
  return courses.find((c) => lower.includes(c.name.toLowerCase()) || lower.includes(c.code.toLowerCase())) ?? null;
}

function QuickCaptureBar({ courses }: { courses: CourseLite[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ title: string; dueAt: Date | null; course: CourseLite | null; kind: CaptureKind } | null>(null);
  const [busy, setBusy] = useState(false);

  function parse() {
    if (!text.trim()) return;
    // Parsed entirely in the browser so "2pm" resolves in the user's own
    // timezone rather than the server's.
    const parsed = parseQuickCapture(text, new Date());
    const course = matchCourse(parsed.courseHint, parsed.title, courses);
    const kind = NEEDS_COURSE.includes(parsed.kind) && !course ? "task" : parsed.kind;
    setPreview({ title: parsed.title, dueAt: parsed.dueAt, course, kind });
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    try {
      const dueIso = preview.dueAt?.toISOString() ?? null;
      let url = "";
      let body: Record<string, unknown> = {};
      switch (preview.kind) {
        case "assignment":
          url = "/api/assignments";
          body = { courseId: preview.course!.id, title: preview.title, dueAt: dueIso };
          break;
        case "quiz":
        case "exam":
          url = "/api/quizzes";
          body = { courseId: preview.course!.id, title: preview.title, kind: preview.kind === "exam" ? "exam" : "quiz", startAt: dueIso };
          break;
        case "event":
          url = "/api/events";
          body = { title: preview.title, type: "personal", startAt: dueIso ?? new Date().toISOString(), courseId: preview.course?.id ?? null };
          break;
        default:
          url = "/api/tasks";
          body = { title: preview.title, kind: preview.kind, dueAt: dueIso, courseId: preview.course?.id ?? null };
      }
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        toast(data?.error ?? "Could not save — check the details and try again", "error");
        setBusy(false);
        return;
      }
      toast(`${KIND_LABEL[preview.kind]} added`);
      setText("");
      setPreview(null);
      setBusy(false);
      router.refresh();
      window.dispatchEvent(new CustomEvent("nudges:changed"));
    } catch {
      toast("Could not save — check your connection", "error");
      setBusy(false);
    }
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
        <div className="mt-2 rounded-lg border border-border-base bg-surface-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium">{preview.title}</span>
            <span className="text-xs text-muted">
              {preview.dueAt ? format(preview.dueAt, "MMM d, h:mm a") : "no date detected"}
              {preview.course ? ` · ${preview.course.code}` : ""}
            </span>
            <span className="grow" />
            <Button size="xs" variant="primary" onClick={confirm} disabled={busy}>Save</Button>
            <Button size="xs" variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(KIND_LABEL) as CaptureKind[])
              .filter((k) => !NEEDS_COURSE.includes(k) || preview.course)
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPreview((p) => (p ? { ...p, kind: k } : p))}
                  aria-pressed={preview.kind === k}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                    preview.kind === k ? "border-accent bg-accent-soft text-accent" : "border-border-base text-muted hover:text-foreground",
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SyncLine({ ctx }: { ctx: WidgetCtx }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const log = ctx.data.lastSync;

  // Manual mode: no source to sync from, so the row would only be noise.
  if (!ctx.data.brightspaceEnabled) return null;

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
