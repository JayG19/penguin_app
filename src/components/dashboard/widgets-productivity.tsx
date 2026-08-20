"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Square } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Input, Segmented, Select, Textarea, toast } from "@/components/ui";
import { cn, courseColor, fmtMinutes } from "@/lib/utils";
import { projectedFinal, requiredOnRemaining, summarizeGrades } from "@/lib/grades";
import { useFocus } from "@/components/focus/FocusProvider";
import { TOOL_ICONS } from "@/components/tool-icons";
import type { WidgetCtx } from "./DashboardClient";

/* ================= Calendar (compact) ================= */

export function CalendarWidget({ ctx, bare }: { ctx: WidgetCtx; bare?: boolean }) {
  const { data, courseFilter } = ctx;
  const [view, setView] = useState<"month" | "agenda">("month");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());

  const items = useMemo(() => {
    type Item = { date: Date; title: string; color: string; kind: string; open?: () => void };
    const list: Item[] = [];
    for (const a of data.assignments) {
      if (!a.dueAt || (courseFilter && a.courseId !== courseFilter)) continue;
      list.push({ date: new Date(a.dueAt), title: a.title, color: a.course.color, kind: "assignment", open: () => ctx.openAssignment(a) });
    }
    for (const q of data.quizzes) {
      if (!q.startAt || (courseFilter && q.courseId !== courseFilter)) continue;
      list.push({ date: new Date(q.startAt), title: q.title, color: q.course.color, kind: q.kind, open: () => ctx.openQuiz(q) });
    }
    for (const e of data.events) {
      if (courseFilter && e.courseId !== courseFilter) continue;
      list.push({ date: new Date(e.startAt), title: e.title, color: e.course?.color ?? "sky", kind: e.type });
    }
    return list;
  }, [data, courseFilter, ctx]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedItems = items
    .filter((i) => isSameDay(i.date, selected))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const agenda = items
    .filter((i) => i.date >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);

  const body = (
    <>
      <CardHeader
        title="Calendar"
        action={
          <div className="flex items-center gap-1.5">
            <Segmented size="sm" options={[{ value: "month", label: "Month" }, { value: "agenda", label: "Agenda" }]} value={view} onChange={setView} />
            <Link href="/calendar" className="text-xs text-accent hover:underline">Full</Link>
          </div>
        }
      />
      {view === "month" ? (
        <div className="px-4 pb-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <button onClick={() => setCursor(subMonths(cursor, 1))} className="p-1 rounded hover:bg-surface-2 text-muted" aria-label="Previous month"><ChevronLeft size={14} /></button>
            <span className="text-[13px] font-medium">{format(cursor, "MMMM yyyy")}</span>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-1 rounded hover:bg-surface-2 text-muted" aria-label="Next month"><ChevronRight size={14} /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] text-faint mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const dayItems = items.filter((i) => isSameDay(i.date, day));
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "relative aspect-square rounded-md text-xs flex flex-col items-center justify-center",
                    !isSameMonth(day, cursor) && "text-faint",
                    isSameDay(day, selected) && "bg-accent-soft text-accent font-semibold",
                    isToday(day) && !isSameDay(day, selected) && "font-semibold text-accent",
                    "hover:bg-surface-2",
                  )}
                  aria-label={format(day, "MMMM d")}
                >
                  {format(day, "d")}
                  {dayItems.length > 0 && (
                    <span className="absolute bottom-1 flex gap-px">
                      {dayItems.slice(0, 3).map((i, idx) => (
                        <span key={idx} className={cn("h-1 w-1 rounded-full", courseColor(i.color).dot)} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 border-t border-border-base pt-2 min-h-14">
            <p className="text-[11px] text-muted mb-1">{format(selected, "EEEE, MMM d")}</p>
            {selectedItems.length === 0 ? (
              <p className="text-xs text-faint">Nothing scheduled.</p>
            ) : (
              selectedItems.slice(0, 3).map((i, idx) => (
                <button key={idx} onClick={i.open} disabled={!i.open} className={cn("flex items-center gap-1.5 text-xs py-0.5 w-full text-left", i.open && "hover:text-accent")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", courseColor(i.color).dot)} />
                  <span className="truncate">{i.title}</span>
                  <span className="text-faint ml-auto shrink-0">{format(i.date, "h:mm a")}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3.5 space-y-0.5">
          {agenda.length === 0 && <EmptyState title="Nothing coming up" />}
          {agenda.map((i, idx) => (
            <button key={idx} onClick={i.open} disabled={!i.open} className={cn("flex items-center gap-2 w-full text-left py-1", i.open && "hover:text-accent")}>
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", courseColor(i.color).dot)} />
              <span className="text-[13px] truncate grow">{i.title}</span>
              <span className="text-[11px] text-faint shrink-0">{format(i.date, "EEE d, h:mm a")}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
  return bare ? body : <Card>{body}</Card>;
}

/* ================= Grade planner ================= */

export function GradeWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data, courseFilter } = ctx;
  const [courseId, setCourseId] = useState(courseFilter || data.courses[0]?.id || "");
  const [target, setTarget] = useState(85);

  const active = courseFilter || courseId;
  const items = data.grades.filter((g) => g.courseId === active);
  const summary = summarizeGrades(items);
  const required = requiredOnRemaining(summary, target);
  const projected = summary.currentGrade != null ? projectedFinal(summary, summary.currentGrade) : null;

  return (
    <Card>
      <CardHeader title="Grade planner" action={
        <Select value={active} onChange={(e) => setCourseId(e.target.value)} className="h-7 w-auto text-xs" aria-label="Course">
          {data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
      } />
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="rounded-lg bg-surface-2 py-2">
            <p className="text-lg font-semibold tabular-nums">{summary.currentGrade != null ? `${summary.currentGrade.toFixed(1)}%` : "—"}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide">Current</p>
          </div>
          <div className="rounded-lg bg-surface-2 py-2">
            <p className="text-lg font-semibold tabular-nums">{summary.remainingWeight.toFixed(0)}%</p>
            <p className="text-[10px] text-muted uppercase tracking-wide">Remaining</p>
          </div>
          <div className="rounded-lg bg-surface-2 py-2">
            <p className="text-lg font-semibold tabular-nums">{projected != null ? `${projected.toFixed(0)}%` : "—"}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide">On pace for</p>
          </div>
        </div>
        <label htmlFor="gw-target" className="flex items-center justify-between text-[13px] mb-1">
          <span className="text-muted">Target grade</span>
          <span className="font-semibold tabular-nums">{target}%</span>
        </label>
        <input
          id="gw-target"
          type="range" min={50} max={100} value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
        <p className="text-[13px] mt-2">
          {required == null ? (
            <span className="text-muted">All weight graded — final grade is locked in.</span>
          ) : required > 100 ? (
            <span className="text-rose-600 dark:text-rose-400">Need {required.toFixed(1)}% on remaining work — above 100%, consider adjusting the target.</span>
          ) : required <= 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">Target already secured 🎉</span>
          ) : (
            <>Required on remaining work: <span className="font-semibold tabular-nums">{required.toFixed(1)}%</span></>
          )}
        </p>
        <Link href={`/courses/${active}?tab=grades`} className="text-xs text-accent hover:underline mt-1 inline-block">
          Open grade dashboard
        </Link>
      </div>
    </Card>
  );
}

/* ================= Quick note ================= */

export function QuickNoteWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data } = ctx;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim() && !body.trim()) return;
    setBusy(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || body.slice(0, 40), body, courseId: courseId || null }),
    });
    toast("Note saved");
    setTitle(""); setBody(""); setCourseId("");
    setBusy(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Quick note" action={<Link href="/notes" className="text-xs text-accent hover:underline">All notes</Link>} />
      <div className="px-4 pb-4 space-y-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" aria-label="Note title" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Remember to ask professor about…" aria-label="Note body" />
        <div className="flex gap-2">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Note course" className="text-xs h-8">
            <option value="">No course</option>
            {data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </Select>
          <Button size="sm" variant="primary" onClick={save} disabled={busy || (!title.trim() && !body.trim())}>Save Note</Button>
        </div>
      </div>
    </Card>
  );
}

/* ================= Focus timer ================= */

export function FocusWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data } = ctx;
  const { session, start, pause, resume, finish } = useFocus();
  const [minutes, setMinutes] = useState<number>(25);
  const [custom, setCustom] = useState("");
  const [label, setLabel] = useState("");

  const openAssignments = data.assignments.filter((a) => !["completed", "submitted"].includes(a.status)).slice(0, 8);

  if (session) {
    const total = session.minutes * 60;
    const pct = ((total - session.secondsLeft) / total) * 100;
    const m = Math.floor(session.secondsLeft / 60);
    const s = session.secondsLeft % 60;
    return (
      <Card>
        <CardHeader title="Focus session" />
        <div className="px-4 pb-4 text-center">
          <p className="text-[13px] text-muted truncate">{session.label}</p>
          <p className="text-4xl font-semibold tabular-nums my-3">{m}:{s.toString().padStart(2, "0")}</p>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-3">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-center gap-2">
            {session.running ? (
              <Button size="sm" variant="secondary" onClick={pause}><Pause size={13} /> Pause</Button>
            ) : (
              <Button size="sm" variant="primary" onClick={resume}><Play size={13} /> Resume</Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => finish()}><Square size={13} /> Finish</Button>
            <Button size="sm" variant="ghost" onClick={() => finish(true)}>Skip</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Focus timer" />
      <div className="px-4 pb-4 space-y-2.5">
        <div className="flex gap-1.5">
          {[25, 50, 90].map((m) => (
            <button
              key={m}
              onClick={() => { setMinutes(m); setCustom(""); }}
              className={cn(
                "grow rounded-lg border py-1.5 text-[13px] font-medium",
                minutes === m && !custom ? "border-accent/40 bg-accent-soft text-accent" : "border-border-base text-muted hover:text-foreground",
              )}
            >
              {m} min
            </button>
          ))}
          <Input
            type="number" min={5} max={240} value={custom} placeholder="min"
            onChange={(e) => setCustom(e.target.value)}
            className="w-16 text-center"
            aria-label="Custom minutes"
          />
        </div>
        <Select value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Link to task">
          <option value="">Untitled focus session</option>
          {openAssignments.map((a) => (
            <option key={a.id} value={`a:${a.id}`}>{a.course.code} — {a.title}</option>
          ))}
        </Select>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            const mins = custom ? Math.max(5, Math.min(240, Number(custom))) : minutes;
            const linked = label.startsWith("a:") ? openAssignments.find((a) => a.id === label.slice(2)) : null;
            start({
              label: linked ? linked.title : "Focus session",
              minutes: mins,
              courseId: linked?.courseId ?? null,
              assignmentId: linked?.id ?? null,
            });
          }}
        >
          <Play size={14} /> Start focus session
        </Button>
      </div>
    </Card>
  );
}

/* ================= Study progress ================= */

export function StudyWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data } = ctx;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const thisWeek = data.sessions.filter((s) => new Date(s.startedAt) >= weekStart);
  const todayMins = data.sessions.filter((s) => isToday(new Date(s.startedAt))).reduce((sum, s) => sum + s.minutes, 0);
  const weekMins = thisWeek.reduce((sum, s) => sum + s.minutes, 0);

  const byCourse: Record<string, number> = {};
  for (const s of thisWeek) {
    const code = s.course?.code ?? "Other";
    byCourse[code] = (byCourse[code] ?? 0) + s.minutes;
  }
  const top = Object.entries(byCourse).sort((a, b) => b[1] - a[1]);
  const tasksDone = data.tasks.filter((t) => t.completed).length +
    data.assignments.filter((a) => ["completed", "submitted"].includes(a.status)).length;
  const tasksLeft = data.tasks.filter((t) => !t.completed).length +
    data.assignments.filter((a) => !["completed", "submitted"].includes(a.status)).length;

  // last 7 days mini bars
  const bars = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(now, i - 6);
    const mins = data.sessions.filter((s) => isSameDay(new Date(s.startedAt), day)).reduce((sum, s) => sum + s.minutes, 0);
    return { day, mins };
  });
  const maxMins = Math.max(60, ...bars.map((b) => b.mins));

  return (
    <Card>
      <CardHeader title="Study progress" />
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg bg-surface-2 p-2.5">
            <p className="text-base font-semibold tabular-nums">{fmtMinutes(todayMins)}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide">Today</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-2.5">
            <p className="text-base font-semibold tabular-nums">{fmtMinutes(weekMins)}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide">This week</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-2.5">
            <p className="text-base font-semibold tabular-nums">{tasksDone}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide">Done</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-2.5">
            <p className="text-base font-semibold tabular-nums">{tasksLeft}</p>
            <p className="text-[10px] text-muted uppercase tracking-wide">Remaining</p>
          </div>
        </div>
        <div className="flex items-end gap-1 h-12 mb-1" aria-hidden>
          {bars.map((b, i) => (
            <div key={i} className="grow flex flex-col items-center gap-0.5">
              <div className="w-full rounded-sm bg-accent/70" style={{ height: `${Math.max(4, (b.mins / maxMins) * 100)}%` }} title={`${format(b.day, "EEE")}: ${fmtMinutes(b.mins)}`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-faint mb-2">
          {bars.map((b, i) => <span key={i}>{format(b.day, "EEEEE")}</span>)}
        </div>
        {top[0] && (
          <p className="text-xs text-muted">
            Most studied: <span className="font-medium text-foreground">{top[0][0]}</span> ({fmtMinutes(top[0][1])})
          </p>
        )}
      </div>
    </Card>
  );
}

/* ================= Workload ================= */

export function WorkloadWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data } = ctx;
  const now = new Date();
  const horizon = addDays(now, 7);

  const load: Record<string, { code: string; color: string; hours: number; courseId: string }> = {};
  for (const c of data.courses) {
    load[c.id] = { code: c.code, color: c.color, hours: 0, courseId: c.id };
  }
  for (const a of data.assignments) {
    if (!a.dueAt || ["completed", "submitted"].includes(a.status)) continue;
    const due = new Date(a.dueAt);
    if (due < now || due > horizon) continue;
    const remaining = 1 - a.completionPct / 100;
    load[a.courseId].hours += (a.estimatedHours ?? Math.max(1.5, (a.weight ?? 5) / 4)) * remaining;
  }
  for (const q of data.quizzes) {
    if (!q.startAt || q.status !== "upcoming") continue;
    const at = new Date(q.startAt);
    if (at < now || at > horizon) continue;
    load[q.courseId].hours += Math.max(1, (q.weight ?? 5) / 5); // prep time scales with weight
  }
  const rows = Object.values(load).filter((r) => r.hours > 0).sort((a, b) => b.hours - a.hours);
  const max = Math.max(1, ...rows.map((r) => r.hours));
  const total = rows.reduce((s, r) => s + r.hours, 0);

  return (
    <Card>
      <CardHeader title="Workload — next 7 days" action={<span className="text-xs text-muted tabular-nums">≈{total.toFixed(0)}h total</span>} />
      {rows.length === 0 ? (
        <EmptyState title="Light week ahead" hint="No significant workload detected in the next 7 days 🎉" />
      ) : (
        <div className="px-4 pb-4 space-y-2">
          {rows.map((r) => (
            <Link key={r.code} href={`/courses/${r.courseId}?tab=assignments`} className="block group">
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="font-medium group-hover:text-accent">{r.code}</span>
                <span className="text-muted tabular-nums">≈{r.hours.toFixed(1)}h</span>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className={cn("h-full rounded-full", courseColor(r.color).bar)} style={{ width: `${(r.hours / max) * 100}%` }} />
              </div>
            </Link>
          ))}
          <p className="text-[11px] text-faint pt-1">Estimated from assignment hours, weights and quiz prep.</p>
        </div>
      )}
    </Card>
  );
}

/* ================= Tools ================= */

export function ToolsWidget({ ctx }: { ctx: WidgetCtx }) {
  const { data } = ctx;
  return (
    <Card>
      <CardHeader title="Quick tools" action={<Link href="/tools" className="text-xs text-accent hover:underline">Customize</Link>} />
      {data.tools.length === 0 ? (
        <EmptyState
          title="No pinned tools"
          hint="Pin your favorite tools to reach them from the dashboard."
          actions={<Link href="/tools"><Button size="sm" variant="outline">Open Tools</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {data.tools.map((t) => {
            const Icon = TOOL_ICONS[t.icon] ?? ArrowUpRight;
            return (
              <a
                key={t.id}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border-base p-2.5 hover:border-border-strong hover:bg-surface-2 transition-colors"
              >
                <Icon size={17} className="text-muted" />
                <span className="text-[11px] font-medium truncate max-w-full">{t.name}</span>
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}
