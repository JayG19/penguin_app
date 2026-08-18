"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlarmClockOff, ArrowRight, BellRing, Check, CheckCircle2, ChevronDown, ChevronRight,
  ExternalLink, Play, RefreshCw, Sparkles,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { Badge, Button, Card, CardHeader, EmptyState, PriorityBadge, ProgressBar, Spinner, toast } from "@/components/ui";
import { cn, countdown, courseColor, fmtDate, relativeDue, timeAgo } from "@/lib/utils";
import { priorityScore, computePriority } from "@/lib/priority";
import type { WidgetCtx } from "./DashboardClient";
import type { AnnouncementDTO } from "@/components/types";
import type { SyncDetail } from "@/lib/sync/engine";

/* ================= Today ================= */

export function TodayWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    // Re-read the clock on mount: the server renders in its own timezone, so
    // the first client paint corrects it (the nodes below opt out of the
    // hydration diff for the same reason).
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const inCourse = <T extends { courseId?: string | null }>(x: T) => !courseFilter || x.courseId === courseFilter;

  const todayEvents = data.events.filter((e) => isToday(new Date(e.startAt)) && inCourse(e));
  const dueToday = data.assignments.filter(
    (a) => a.dueAt && isToday(new Date(a.dueAt)) && !["completed", "submitted"].includes(a.status) && inCourse(a),
  );
  const quizzesToday = data.quizzes.filter((q) => q.startAt && isToday(new Date(q.startAt)) && q.status === "upcoming" && inCourse(q));
  const tasksToday = data.tasks.filter((t) => t.dueAt && isToday(new Date(t.dueAt)) && !t.completed && inCourse(t));

  const week = 7 * 864e5;
  const dueThisWeek = data.assignments.filter(
    (a) => a.dueAt && new Date(a.dueAt).getTime() - now.getTime() < week && new Date(a.dueAt) > now && !["completed", "submitted"].includes(a.status) && inCourse(a),
  ).length + data.tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() - now.getTime() < week && new Date(t.dueAt) > now && !t.completed && inCourse(t)).length;
  const upcomingQuizzes = data.quizzes.filter((q) => q.startAt && new Date(q.startAt) > now && q.kind === "quiz" && q.status === "upcoming" && inCourse(q)).length;
  const upcomingExams = data.quizzes.filter((q) => q.startAt && new Date(q.startAt) > now && q.kind !== "quiz" && q.status === "upcoming" && inCourse(q)).length;
  const newAnnouncements = data.announcements.filter((a) => !a.read && inCourse(a)).length;
  const term = data.courses[0]?.term ?? "—";

  type Row = { time: Date; label: string; sub: string; kind: "class" | "assignment" | "quiz" | "task" | "event"; onOpen?: () => void; onComplete?: () => void };
  const rows: Row[] = [
    ...todayEvents.map((e) => ({
      time: new Date(e.startAt),
      label: e.title,
      sub: [e.course?.code, e.location].filter(Boolean).join(" · "),
      kind: (e.type === "class" ? "class" : "event") as Row["kind"],
    })),
    ...dueToday.map((a) => ({
      time: new Date(a.dueAt!),
      label: a.title,
      sub: `${a.course.code}${a.weight != null ? ` · ${a.weight}%` : ""} · Due today`,
      kind: "assignment" as const,
      onOpen: () => ctx.openAssignment(a),
      onComplete: async () => {
        await fetch(`/api/assignments/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
        toast("Marked complete 🎉");
        window.location.reload();
      },
    })),
    ...quizzesToday.map((q) => ({
      time: new Date(q.startAt!),
      label: q.title,
      sub: `${q.course.code}${q.weight ? ` · ${q.weight}%` : ""}${q.location ? ` · ${q.location}` : ""}`,
      kind: "quiz" as const,
      onOpen: () => ctx.openQuiz(q),
    })),
    ...tasksToday.map((t) => ({
      time: new Date(t.dueAt!),
      label: t.title,
      sub: t.course?.code ?? "Personal",
      kind: "task" as const,
      onComplete: async () => {
        await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) });
        toast("Task done ✓");
        window.location.reload();
      },
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  const KIND_STYLE: Record<Row["kind"], string> = {
    class: "bg-sky-500",
    assignment: "bg-amber-500",
    quiz: "bg-rose-500",
    task: "bg-emerald-500",
    event: "bg-violet-500",
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 pb-3 border-b border-border-base">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Today</p>
          <h2 className="text-lg font-semibold tracking-tight" suppressHydrationWarning>{format(now, "EEEE, MMMM d")}</h2>
          <p className="text-[13px] text-muted tabular-nums" suppressHydrationWarning>{format(now, "h:mm a")} · {term}</p>
        </div>
        <div className="flex gap-4 text-center">
          {[
            { n: dueToday.length + tasksToday.length, label: "due today" },
            { n: dueThisWeek, label: "this week" },
            { n: upcomingQuizzes, label: "quizzes" },
            { n: upcomingExams, label: "exams" },
            { n: newAnnouncements, label: "unread" },
          ].map((s) => (
            <div key={s.label}>
              <p className={cn("text-lg font-semibold tabular-nums", s.n > 0 ? "text-foreground" : "text-faint")}>{s.n}</p>
              <p className="text-[10px] text-muted uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border-base">
        {rows.length === 0 && (
          <EmptyState
            title="Nothing scheduled today"
            hint="You're all caught up 🎉 Use the time to get ahead on upcoming deadlines."
            actions={
              <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "task" } }))}>
                Add a task
              </Button>
            }
          />
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 group">
            <span className="w-16 shrink-0 text-[12px] text-muted tabular-nums">{format(r.time, "h:mm a")}</span>
            <span className={cn("h-2 w-2 rounded-full shrink-0", KIND_STYLE[r.kind])} aria-hidden />
            <button
              onClick={r.onOpen}
              className={cn("min-w-0 grow text-left", r.onOpen && "hover:text-accent")}
              disabled={!r.onOpen}
            >
              <p className="text-[13px] font-medium truncate">{r.label}</p>
              <p className="text-xs text-muted truncate">{r.sub}</p>
            </button>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {r.onOpen && (
                <Button size="xs" variant="outline" onClick={r.onOpen}>Open</Button>
              )}
              {r.onComplete && (
                <Button size="xs" variant="outline" onClick={r.onComplete}>
                  <Check size={12} /> Done
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ================= Priority ================= */

export function PriorityWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const router = useRouter();
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    const now = new Date();
    type Item = {
      key: string;
      title: string;
      courseCode: string | null;
      color: string;
      dueAt: string | null;
      weight: number | null;
      score: number;
      priority: string;
      kind: "assignment" | "quiz" | "task";
      open?: () => void;
      complete: () => Promise<void>;
      snoozeUrl: string;
      focusLabel: string;
      courseId: string | null;
      assignmentId?: string;
    };
    const list: Item[] = [];
    for (const a of data.assignments) {
      if (["completed", "submitted"].includes(a.status)) continue;
      if (courseFilter && a.courseId !== courseFilter) continue;
      const base = { dueAt: a.dueAt, weight: a.weight, completionPct: a.completionPct, estimatedHours: a.estimatedHours, priorityOverride: a.priorityOverride };
      list.push({
        key: `a-${a.id}`,
        title: a.title,
        courseCode: a.course.code,
        color: a.course.color,
        dueAt: a.dueAt,
        weight: a.weight,
        score: priorityScore(base, now),
        priority: computePriority(base, now),
        kind: "assignment",
        open: () => ctx.openAssignment(a),
        complete: async () => {
          await fetch(`/api/assignments/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
        },
        snoozeUrl: `/api/assignments/${a.id}`,
        focusLabel: a.title,
        courseId: a.courseId,
        assignmentId: a.id,
      });
    }
    for (const q of data.quizzes) {
      if (q.status !== "upcoming" || !q.startAt || new Date(q.startAt) < now) continue;
      if (courseFilter && q.courseId !== courseFilter) continue;
      const base = { dueAt: q.startAt, weight: q.weight, priorityOverride: q.priorityOverride };
      list.push({
        key: `q-${q.id}`,
        title: q.title,
        courseCode: q.course.code,
        color: q.course.color,
        dueAt: q.startAt,
        weight: q.weight,
        score: priorityScore(base, now),
        priority: computePriority(base, now),
        kind: "quiz",
        open: () => ctx.openQuiz(q),
        complete: async () => {
          await fetch(`/api/quizzes/${q.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
        },
        snoozeUrl: `/api/quizzes/${q.id}`,
        focusLabel: `Study: ${q.title}`,
        courseId: q.courseId,
      });
    }
    for (const t of data.tasks) {
      if (t.completed) continue;
      if (courseFilter && t.courseId !== courseFilter) continue;
      const base = { dueAt: t.dueAt, weight: t.weight ?? 3, priorityOverride: t.priorityOverride };
      list.push({
        key: `t-${t.id}`,
        title: t.title,
        courseCode: t.course?.code ?? null,
        color: t.course?.color ?? "indigo",
        dueAt: t.dueAt,
        weight: t.weight,
        score: priorityScore(base, now),
        priority: computePriority(base, now),
        kind: "task",
        complete: async () => {
          await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) });
        },
        snoozeUrl: `/api/tasks/${t.id}`,
        focusLabel: t.title,
        courseId: t.courseId,
      });
    }
    return list.filter((i) => !snoozed.has(i.key)).sort((a, b) => b.score - a.score).slice(0, 5);
  }, [data, courseFilter, snoozed, ctx]);

  async function snooze(item: (typeof items)[number]) {
    if (item.dueAt) {
      const next = new Date(new Date(item.dueAt).getTime() + 864e5).toISOString();
      const body = item.kind === "quiz" ? { startAt: next } : { dueAt: next };
      await fetch(item.snoozeUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      toast("Snoozed to tomorrow");
    }
    setSnoozed((s) => new Set([...s, item.key]));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="What should I work on?" action={<Sparkles size={14} className="text-faint" />} />
      {items.length === 0 ? (
        <EmptyState
          title="No open tasks"
          hint="Everything's done — nice work 🎉"
          actions={
            <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "assignment" } }))}>
              Add Assignment
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border-base">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-3 px-4 py-2.5 group">
              <span className={cn("h-2 w-2 rounded-full shrink-0", courseColor(item.color).dot)} aria-hidden />
              <button onClick={item.open} disabled={!item.open} className={cn("min-w-0 grow text-left", item.open && "hover:text-accent")}>
                <p className="text-[13px] font-medium truncate">
                  {item.courseCode && <span className="text-muted">{item.courseCode} — </span>}
                  {item.title}
                </p>
                <p className="text-xs text-muted">
                  {item.weight != null && item.weight > 0 ? `${item.weight}% · ` : ""}
                  {relativeDue(item.dueAt)}
                </p>
              </button>
              <PriorityBadge priority={item.priority} />
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <Button
                  size="xs" variant="outline" title="Start focus session"
                  onClick={() => window.dispatchEvent(new CustomEvent("focus:start", { detail: { label: item.focusLabel, minutes: 25, courseId: item.courseId, assignmentId: item.assignmentId } }))}
                >
                  <Play size={11} /> Start
                </Button>
                <Button size="xs" variant="outline" title="Mark complete" onClick={async () => { await item.complete(); toast("Done ✓"); router.refresh(); }}>
                  <Check size={11} />
                </Button>
                <Button size="xs" variant="outline" title="Snooze one day" onClick={() => snooze(item)}>
                  <AlarmClockOff size={11} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ================= Deadlines ================= */

type DeadlineFilter = "all" | "assignments" | "quizzes" | "exams" | "projects";

export function DeadlinesWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const [filter, setFilter] = useState<DeadlineFilter>("all");

  const items = useMemo(() => {
    const now = new Date();
    type D = { key: string; date: Date; title: string; courseCode: string | null; color: string; weight: number | null; kind: string; open?: () => void };
    const list: D[] = [];
    for (const a of data.assignments) {
      if (!a.dueAt || ["completed", "submitted"].includes(a.status) || new Date(a.dueAt) < now) continue;
      if (courseFilter && a.courseId !== courseFilter) continue;
      list.push({ key: `a${a.id}`, date: new Date(a.dueAt), title: a.title, courseCode: a.course.code, color: a.course.color, weight: a.weight, kind: "assignment", open: () => ctx.openAssignment(a) });
    }
    for (const q of data.quizzes) {
      if (!q.startAt || q.status !== "upcoming" || new Date(q.startAt) < now) continue;
      if (courseFilter && q.courseId !== courseFilter) continue;
      list.push({ key: `q${q.id}`, date: new Date(q.startAt), title: q.title, courseCode: q.course.code, color: q.course.color, weight: q.weight, kind: q.kind, open: () => ctx.openQuiz(q) });
    }
    for (const t of data.tasks) {
      if (!t.dueAt || t.completed || new Date(t.dueAt) < now) continue;
      if (courseFilter && t.courseId !== courseFilter) continue;
      if (!["project", "presentation"].includes(t.kind)) continue;
      list.push({ key: `t${t.id}`, date: new Date(t.dueAt), title: t.title, courseCode: t.course?.code ?? null, color: t.course?.color ?? "indigo", weight: t.weight, kind: t.kind });
    }
    return list
      .filter((d) => {
        if (filter === "all") return true;
        if (filter === "assignments") return d.kind === "assignment";
        if (filter === "quizzes") return d.kind === "quiz";
        if (filter === "exams") return ["midterm", "final", "exam"].includes(d.kind);
        return ["project", "presentation"].includes(d.kind);
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [data, courseFilter, filter, ctx]);

  const dayLabel = (d: Date) => (isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE MMM d"));

  return (
    <Card>
      <CardHeader title="Upcoming deadlines" />
      <div className="flex gap-1 px-4 pb-2 flex-wrap">
        {(["all", "assignments", "quizzes", "exams", "projects"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border",
              filter === f ? "bg-accent-soft text-accent border-accent/30" : "text-muted border-border-base hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="No upcoming deadlines"
          hint="You're all caught up 🎉"
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "assignment" } }))}>Add Assignment</Button>
            </>
          }
        />
      ) : (
        <div className="px-4 pb-3">
          <ol className="relative ml-2 border-l border-border-base">
            {items.map((d) => (
              <li key={d.key} className="ml-4 py-1.5 relative">
                <span className={cn("absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full border-2 border-surface", courseColor(d.color).dot)} aria-hidden />
                <button onClick={d.open} disabled={!d.open} className={cn("w-full text-left group", d.open && "cursor-pointer")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("text-[13px] font-medium truncate", d.open && "group-hover:text-accent")}>{d.title}</p>
                    {d.weight != null && d.weight > 0 && <span className="text-xs text-muted tabular-nums shrink-0">{d.weight}%</span>}
                  </div>
                  <p className="text-xs text-muted">
                    {d.courseCode ? `${d.courseCode} · ` : ""}{dayLabel(d.date)}, {format(d.date, "h:mm a")}
                  </p>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

/* ================= Courses ================= */

export function CoursesWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const now = new Date();
  const courses = data.courses.filter((c) => !courseFilter || c.id === courseFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Courses</h3>
        <Link href="/courses" className="text-xs text-accent hover:underline flex items-center gap-0.5">
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {courses.map((c) => {
          const cc = courseColor(c.color);
          const gradeItems = data.grades.filter((g) => g.courseId === c.id && g.score != null);
          const gradedWeight = gradeItems.reduce((s, g) => s + g.weight, 0);
          const earned = gradeItems.reduce((s, g) => s + (g.score! / g.maxScore) * g.weight, 0);
          const grade = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;
          const next = [
            ...data.assignments.filter((a) => a.courseId === c.id && a.dueAt && new Date(a.dueAt) > now && !["completed", "submitted"].includes(a.status)).map((a) => ({ date: new Date(a.dueAt!), label: a.title, weight: a.weight })),
            ...data.quizzes.filter((q) => q.courseId === c.id && q.startAt && new Date(q.startAt) > now && q.status === "upcoming").map((q) => ({ date: new Date(q.startAt!), label: q.title, weight: q.weight })),
          ].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
          const unread = data.unreadByCourse[c.id] ?? 0;
          const overdue = data.assignments.filter((a) => a.courseId === c.id && a.dueAt && new Date(a.dueAt) < now && !["completed", "submitted"].includes(a.status)).length;

          return (
            <Card key={c.id} className="p-3.5 hover:border-border-strong transition-colors">
              <Link href={`/courses/${c.id}`} className="block group">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-[13px] font-semibold group-hover:text-accent", cc.text)}>{c.code}</span>
                  <div className="flex items-center gap-1.5">
                    {overdue > 0 && <Badge tone="red">{overdue} overdue</Badge>}
                    {unread > 0 && (
                      <Badge tone="accent" title={`${unread} unread announcements`}>
                        <BellRing size={10} /> {unread}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-[13px] font-medium truncate mt-0.5">{c.name}</p>
              </Link>
              <div className="mt-2.5 flex items-center justify-between text-xs">
                <Link href={`/courses/${c.id}?tab=grades`} className="hover:text-accent" title="Open grade dashboard">
                  <span className="text-muted">Grade </span>
                  <span className="font-semibold tabular-nums">{grade != null ? `${grade.toFixed(0)}%` : "—"}</span>
                </Link>
                <span className="text-muted tabular-nums">{Math.round(c.progress * 100)}% done</span>
              </div>
              <Link href={`/courses/${c.id}`} title="Course progress">
                <ProgressBar value={c.progress * 100} className="mt-1.5" barClassName={cc.bar} />
              </Link>
              <div className="mt-2.5 border-t border-border-base pt-2 min-h-10">
                {next ? (
                  <Link href={`/courses/${c.id}?tab=assignments`} className="block hover:text-accent">
                    <p className="text-[11px] text-muted uppercase tracking-wide">Next</p>
                    <p className="text-xs font-medium truncate">
                      {next.label}
                      {next.weight ? ` · ${next.weight}%` : ""} · {relativeDue(next.date.toISOString()).replace("Due ", "")}
                    </p>
                  </Link>
                ) : (
                  <p className="text-xs text-faint">No upcoming deadlines</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ================= Announcements ================= */

export function AnnouncementsWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const list = data.announcements.filter((a) => !courseFilter || a.courseId === courseFilter).slice(0, 5);

  async function setRead(a: AnnouncementDTO, read: boolean) {
    await fetch(`/api/announcements/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read }) });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Announcements"
        action={<Link href="/announcements" className="text-xs text-accent hover:underline">View all</Link>}
      />
      {list.length === 0 ? (
        <EmptyState title="No announcements" hint="New announcements from your courses will appear here." />
      ) : (
        <div className="divide-y divide-border-base">
          {list.map((a) => (
            <div key={a.id} className="px-4 py-2.5">
              <button
                className="flex w-full items-start gap-2.5 text-left"
                onClick={() => {
                  setExpanded(expanded === a.id ? null : a.id);
                  if (!a.read) setRead(a, true);
                }}
                aria-expanded={expanded === a.id}
              >
                <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", a.read ? "bg-border-strong" : "bg-accent")} aria-label={a.read ? "Read" : "Unread"} />
                <span className="min-w-0 grow">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("text-xs font-semibold", courseColor(a.course.color).text)}>{a.course.code}</span>
                    <span className="text-[11px] text-faint">{timeAgo(a.postedAt)}</span>
                  </span>
                  <span className={cn("block text-[13px] truncate", a.read ? "text-muted" : "font-medium")}>{a.title}</span>
                  {a.author && <span className="block text-xs text-muted">{a.author}</span>}
                </span>
                {expanded === a.id ? <ChevronDown size={14} className="text-muted mt-1 shrink-0" /> : <ChevronRight size={14} className="text-muted mt-1 shrink-0" />}
              </button>
              {expanded === a.id && (
                <div className="ml-[18px] mt-2 rounded-lg bg-surface-2 border border-border-base p-3">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{a.body}</p>
                  <div className="flex gap-2 mt-2.5">
                    <Button size="xs" variant="outline" onClick={() => setRead(a, !a.read)}>
                      Mark {a.read ? "unread" : "read"}
                    </Button>
                    {a.brightspaceUrl && (
                      <a href={a.brightspaceUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="xs" variant="outline"><ExternalLink size={11} /> Open Brightspace</Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ================= Sync ================= */

export function SyncWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data } = ctx;
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ added: number; updated: number; removed: number; status: string } | null>(null);
  const log = data.lastSync;

  async function syncNow() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const r = await res.json();
      setResult(r);
      if (r.status === "success") toast(`Sync complete: +${r.added} added, ${r.updated} updated`);
      else toast("Sync failed — see Brightspace page", "error");
      router.refresh();
    } catch {
      toast("Sync failed", "error");
    }
    setSyncing(false);
  }

  const details: SyncDetail[] = useMemo(() => {
    if (!log?.details) return [];
    try { return JSON.parse(log.details) as SyncDetail[]; } catch { return []; }
  }, [log]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of details) {
      if (d.action === "added" || d.action === "updated") {
        counts[`${d.entity}:${d.action}`] = (counts[`${d.entity}:${d.action}`] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([k, n]) => {
        const [entity, action] = k.split(":");
        return `${n} ${entity}${n > 1 ? "s" : ""} ${action}`;
      })
      .slice(0, 4);
  }, [details]);

  return (
    <Card>
      <CardHeader title="Brightspace" action={
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", log?.status === "error" ? "bg-rose-500" : "bg-emerald-500")} />
          {log?.status === "error" ? "Sync error" : "Connected (demo)"}
        </span>
      } />
      <div className="px-4 pb-4">
        {log ? (
          <>
            <p className="text-[13px]">
              Synced <span className="font-medium">{log.finishedAt ? timeAgo(log.finishedAt) : "…"}</span>
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {(result
                ? [`${result.added} added`, `${result.updated} updated`, ...(result.removed ? [`${result.removed} removed`] : [])]
                : summary
              ).map((s, i) => (
                <li key={i} className="text-xs text-muted flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-emerald-500" /> {s}
                </li>
              ))}
              {!result && summary.length === 0 && <li className="text-xs text-faint">No changes in last sync</li>}
            </ul>
          </>
        ) : (
          <p className="text-[13px] text-muted">Never synced.</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" variant="primary" onClick={syncNow} disabled={syncing}>
            {syncing ? <Spinner className="h-3.5 w-3.5 border-white/40 border-t-white" /> : <RefreshCw size={13} />}
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>
          <Link href="/sync" className="text-xs text-accent hover:underline">Details</Link>
        </div>
      </div>
    </Card>
  );
}

/* ================= What's New ================= */

export function WhatsNewWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data } = ctx;
  const router = useRouter();
  const log = data.lastSync;
  const lastSeen = data.preference?.lastSeenFeedAt ? new Date(data.preference.lastSeenFeedAt) : null;

  const fresh = log?.finishedAt && (!lastSeen || new Date(log.finishedAt) > lastSeen);
  const details: SyncDetail[] = useMemo(() => {
    if (!log?.details || !fresh) return [];
    try {
      return (JSON.parse(log.details) as SyncDetail[]).filter((d) => ["added", "updated"].includes(d.action)).slice(0, 7);
    } catch {
      return [];
    }
  }, [log, fresh]);

  async function markReviewed() {
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastSeenFeedAt: new Date().toISOString() }),
    });
    toast("Feed marked as reviewed");
    router.refresh();
  }

  const ICON: Record<string, string> = { added: "+", updated: "↻", conflict: "⚠", removed: "−" };
  const href = (d: SyncDetail) => {
    switch (d.entityType) {
      case "assignment": return `/assignments?open=${d.entityId}`;
      case "quiz": return `/quizzes?open=${d.entityId}`;
      case "announcement": return `/announcements?open=${d.entityId}`;
      case "course": return `/courses/${d.entityId}`;
      case "grade": return `/courses`;
      default: return "/sync";
    }
  };

  return (
    <Card>
      <CardHeader
        title="What's new"
        action={details.length > 0 ? (
          <button onClick={markReviewed} className="text-xs text-accent hover:underline">Mark all reviewed</button>
        ) : undefined}
      />
      {details.length === 0 ? (
        <EmptyState title="Nothing new since your last visit" hint="Changes from Brightspace syncs will show up here." />
      ) : (
        <ul className="px-4 pb-3 space-y-1">
          {details.map((d, i) => (
            <li key={i}>
              <Link href={href(d)} className="flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-surface-2 text-[13px]">
                <span className={cn("font-mono text-xs w-3", d.action === "added" ? "text-emerald-500" : "text-sky-500")}>{ICON[d.action]}</span>
                <span className="truncate grow">{d.label}</span>
                {d.courseCode && <span className="text-[11px] text-faint shrink-0">{d.courseCode}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export { countdown, fmtDate };
