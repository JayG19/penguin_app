"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  addDays, addMonths, addWeeks, addYears, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, setHours, setMinutes, startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, ExternalLink, Plus, Repeat, StickyNote, Timer } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, Segmented, SourceBadge, toast } from "@/components/ui";
import { AssignmentDrawer } from "@/components/AssignmentDrawer";
import { QuizDrawer } from "@/components/QuizDrawer";
import type { AssignmentDTO, CourseDTO, EventDTO, QuizDTO, TaskDTO } from "@/components/types";
import { cn, courseColor, fmtDate } from "@/lib/utils";

type View = "month" | "week" | "day" | "agenda";

interface CalItem {
  key: string;
  id: string;
  kind: "assignment" | "quiz" | "exam" | "class" | "personal" | "reminder" | "event" | "task";
  title: string;
  date: Date;
  endDate?: Date | null;
  color: string;
  courseCode: string | null;
  location: string | null;
  weight: number | null;
  source: string;
  draggable: boolean;
  patchUrl: string;
  patchField: "dueAt" | "startAt";
  brightspaceUrl?: string | null;
  assignment?: AssignmentDTO;
  quiz?: QuizDTO;
  description?: string | null;
  recurring?: boolean;
}

const RECUR_LABEL: Record<string, string> = { daily: "Daily", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" };

/** Expands a recurring event into its individual occurrences for display —
 * stored as one row with a `recurrence` string, materialized client-side so
 * the backend and data model stay simple. Capped so an endless recurrence
 * doesn't run away. */
function expandOccurrences(e: EventDTO): { start: Date; end: Date | null }[] {
  const start = new Date(e.startAt);
  const end = e.endAt ? new Date(e.endAt) : null;
  if (!e.recurrence) return [{ start, end }];
  const [freq, untilStr] = e.recurrence.split(":");
  const duration = end ? end.getTime() - start.getTime() : null;
  const until = untilStr ? new Date(`${untilStr}T23:59:59`) : addYears(start, 2);
  const step = (d: Date) =>
    freq === "daily" ? addDays(d, 1) : freq === "biweekly" ? addWeeks(d, 2) : freq === "monthly" ? addMonths(d, 1) : addWeeks(d, 1);
  const occurrences: { start: Date; end: Date | null }[] = [];
  let cur = start;
  let n = 0;
  while (cur <= until && n < 200) {
    occurrences.push({ start: cur, end: duration != null ? new Date(cur.getTime() + duration) : null });
    cur = step(cur);
    n++;
  }
  return occurrences;
}

const KIND_STYLE: Record<string, { chip: string; label: string }> = {
  assignment: { chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20", label: "Assignment" },
  quiz: { chip: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20", label: "Quiz" },
  exam: { chip: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20", label: "Exam" },
  class: { chip: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20", label: "Class" },
  personal: { chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", label: "Personal" },
  reminder: { chip: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20", label: "Reminder" },
  event: { chip: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20", label: "Event" },
  task: { chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", label: "Task" },
};

export function CalendarClient({
  events, assignments, quizzes, tasks, courses,
}: {
  events: EventDTO[];
  assignments: AssignmentDTO[];
  quizzes: QuizDTO[];
  tasks: TaskDTO[];
  courses: CourseDTO[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [courseFilter, setCourseFilter] = useState("");
  const [selected, setSelected] = useState<CalItem | null>(null);
  const [openA, setOpenA] = useState<AssignmentDTO | null>(null);
  const [openQ, setOpenQ] = useState<QuizDTO | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const items: CalItem[] = useMemo(() => {
    const list: CalItem[] = [];
    for (const e of events) {
      const occurrences = expandOccurrences(e);
      occurrences.forEach((occ, idx) => {
        list.push({
          key: idx === 0 ? `e${e.id}` : `e${e.id}-${idx}`, id: e.id, kind: (e.type as CalItem["kind"]) ?? "event", title: e.title,
          date: occ.start, endDate: occ.end,
          color: e.course?.color ?? "sky", courseCode: e.course?.code ?? null, location: e.location,
          weight: null, source: e.source, draggable: idx === 0 && e.source === "manual" && e.type !== "class",
          patchUrl: `/api/events/${e.id}`, patchField: "startAt", description: e.description,
          recurring: !!e.recurrence,
        });
      });
    }
    for (const a of assignments) {
      list.push({
        key: `a${a.id}`, id: a.id, kind: "assignment", title: a.title, date: new Date(a.dueAt!),
        color: a.course.color, courseCode: a.course.code, location: null, weight: a.weight,
        source: a.source, draggable: true, patchUrl: `/api/assignments/${a.id}`, patchField: "dueAt",
        brightspaceUrl: a.brightspaceUrl, assignment: a,
      });
    }
    for (const q of quizzes) {
      list.push({
        key: `q${q.id}`, id: q.id, kind: q.kind === "quiz" ? "quiz" : "exam", title: q.title,
        date: new Date(q.startAt!), color: q.course.color, courseCode: q.course.code,
        location: q.location, weight: q.weight, source: q.source, draggable: true,
        patchUrl: `/api/quizzes/${q.id}`, patchField: "startAt", brightspaceUrl: q.brightspaceUrl, quiz: q,
      });
    }
    for (const t of tasks) {
      if (t.completed) continue;
      list.push({
        key: `t${t.id}`, id: t.id, kind: "task", title: t.title, date: new Date(t.dueAt!),
        color: t.course?.color ?? "emerald", courseCode: t.course?.code ?? null, location: null,
        weight: t.weight, source: "manual", draggable: true, patchUrl: `/api/tasks/${t.id}`, patchField: "dueAt",
      });
    }
    return list
      .filter((i) => !courseFilter || i.courseCode === courses.find((c) => c.id === courseFilter)?.code)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, assignments, quizzes, tasks, courseFilter, courses]);

  async function moveItem(item: CalItem, day: Date) {
    const prev = item.date;
    const next = setMinutes(setHours(day, prev.getHours()), prev.getMinutes());
    const res = await fetch(item.patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [item.patchField]: next.toISOString() }),
    });
    if (res.ok) {
      toast(`Rescheduled to ${format(next, "MMM d")}`);
      router.refresh();
    } else toast("Could not reschedule", "error");
  }

  const nav = (dir: 1 | -1) => {
    if (view === "month") setCursor(dir === 1 ? addMonths(cursor, 1) : subMonths(cursor, 1));
    else if (view === "week") setCursor(dir === 1 ? addWeeks(cursor, 1) : subWeeks(cursor, 1));
    else setCursor(addDays(cursor, dir));
  };

  const title =
    view === "month" ? format(cursor, "MMMM yyyy")
    : view === "week" ? `Week of ${format(startOfWeek(cursor), "MMM d")}`
    : view === "day" ? format(cursor, "EEEE, MMMM d")
    : "Agenda";

  function openItem(item: CalItem) {
    if (item.assignment) setOpenA(item.assignment);
    else if (item.quiz) setOpenQ(item.quiz);
    else setSelected(item);
  }

  function EventChip({ item, compact }: { item: CalItem; compact?: boolean }) {
    const style = KIND_STYLE[item.kind] ?? KIND_STYLE.event;
    return (
      <button
        draggable={item.draggable}
        onDragStart={(e) => { setDragKey(item.key); e.dataTransfer.effectAllowed = "move"; }}
        onClick={(e) => { e.stopPropagation(); openItem(item); }}
        className={cn(
          "w-full text-left rounded border px-1.5 py-0.5 text-[11px] font-medium truncate block",
          style.chip,
          item.draggable && "cursor-grab active:cursor-grabbing",
        )}
        title={`${item.title}${item.courseCode ? ` (${item.courseCode})` : ""}`}
      >
        {!compact && <span className="opacity-70">{format(item.date, "h:mm a")} </span>}
        {item.title}
        {item.recurring && <Repeat size={9} className="ml-1 inline-block opacity-60 align-baseline" aria-label="Repeats" />}
      </button>
    );
  }

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) }),
    [cursor],
  );

  const agendaItems = items.filter((i) => i.date >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 40);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Calendar</h1>
          <p className="text-[13px] text-muted">Deadlines, classes and personal events in one place.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-8 rounded-lg border border-border-base bg-surface px-2 text-[13px]"
            aria-label="Filter by course"
          >
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
          <Segmented
            options={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }, { value: "agenda", label: "Agenda" }]}
            value={view}
            onChange={setView}
          />
          <Button size="sm" variant="primary" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "event" } }))}>
            <Plus size={13} /> Event
          </Button>
        </div>
      </div>

      {view !== "agenda" && (
        <div className="flex items-center gap-2">
          <button onClick={() => nav(-1)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted" aria-label="Previous"><ChevronLeft size={16} /></button>
          <h2 className="text-[15px] font-medium min-w-44">{title}</h2>
          <button onClick={() => nav(1)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted" aria-label="Next"><ChevronRight size={16} /></button>
          <Button size="xs" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
          <p className="text-[11px] text-faint ml-auto hidden sm:block">Drag manual items & deadlines to reschedule</p>
        </div>
      )}

      {view === "month" && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border-base text-center text-[11px] font-medium text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayItems = items.filter((i) => isSameDay(i.date, day));
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const item = items.find((i) => i.key === dragKey);
                    if (item) moveItem(item, day);
                    setDragKey(null);
                  }}
                  className={cn(
                    "min-h-24 border-b border-r border-border-base p-1 space-y-0.5 last:border-r-0",
                    !isSameMonth(day, cursor) && "bg-surface-2/50",
                  )}
                >
                  <p className={cn(
                    "text-[11px] px-1 tabular-nums",
                    isToday(day) ? "font-bold text-accent" : isSameMonth(day, cursor) ? "text-muted" : "text-faint",
                  )}>
                    {format(day, "d")}
                  </p>
                  {dayItems.slice(0, 3).map((i) => <EventChip key={i.key} item={i} compact />)}
                  {dayItems.length > 3 && (
                    <button className="text-[10px] text-muted px-1 hover:text-accent" onClick={() => { setCursor(day); setView("day"); }}>
                      +{dayItems.length - 3} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === "week" && (
        <Card className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[700px]">
            {weekDays.map((day) => {
              const dayItems = items.filter((i) => isSameDay(i.date, day));
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const item = items.find((i) => i.key === dragKey);
                    if (item) moveItem(item, day);
                    setDragKey(null);
                  }}
                  className="border-r border-border-base last:border-r-0 min-h-72 p-1.5 space-y-1"
                >
                  <p className={cn("text-center text-xs py-1", isToday(day) ? "font-bold text-accent" : "text-muted")}>
                    {format(day, "EEE d")}
                  </p>
                  {dayItems.map((i) => <EventChip key={i.key} item={i} />)}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === "day" && (
        <Card>
          {items.filter((i) => isSameDay(i.date, cursor)).length === 0 ? (
            <EmptyState title="Nothing scheduled" hint="Enjoy the free day 🎉" actions={
              <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "event" } }))}>Add Event</Button>
            } />
          ) : (
            <div className="divide-y divide-border-base">
              {items.filter((i) => isSameDay(i.date, cursor)).map((i) => (
                <button key={i.key} onClick={() => openItem(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className="w-20 text-[13px] text-muted tabular-nums shrink-0">{format(i.date, "h:mm a")}</span>
                  <span className={cn("h-2 w-2 rounded-full shrink-0", courseColor(i.color).dot)} />
                  <span className="min-w-0 grow">
                    <span className="block text-[14px] font-medium truncate">{i.title}</span>
                    <span className="block text-xs text-muted">
                      {KIND_STYLE[i.kind]?.label}{i.courseCode ? ` · ${i.courseCode}` : ""}{i.location ? ` · ${i.location}` : ""}
                    </span>
                  </span>
                  <SourceBadge source={i.source} />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {view === "agenda" && (
        <Card>
          {agendaItems.length === 0 ? (
            <EmptyState title="Nothing coming up" />
          ) : (
            <div className="divide-y divide-border-base">
              {agendaItems.map((i) => (
                <button key={i.key} onClick={() => openItem(i)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                  <span className="w-24 shrink-0 text-xs text-muted">{format(i.date, "EEE, MMM d")}</span>
                  <span className="w-16 shrink-0 text-xs text-muted tabular-nums">{format(i.date, "h:mm a")}</span>
                  <span className={cn("rounded border px-1.5 py-px text-[10px] font-medium shrink-0", KIND_STYLE[i.kind]?.chip)}>{KIND_STYLE[i.kind]?.label}</span>
                  <span className="text-[13px] font-medium truncate grow">{i.title}</span>
                  {i.courseCode && <span className="text-xs text-faint shrink-0">{i.courseCode}</span>}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Event detail popover */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={KIND_STYLE[selected.kind]?.chip}>{KIND_STYLE[selected.kind]?.label}</Badge>
              <SourceBadge source={selected.source} />
              {selected.weight != null && selected.weight > 0 && <Badge>{selected.weight}%</Badge>}
            </div>
            <p className="text-[13px]">
              {fmtDate(selected.date, true)}
              {selected.endDate ? ` – ${format(selected.endDate, "h:mm a")}` : ""}
              {selected.location ? ` · ${selected.location}` : ""}
            </p>
            {selected.recurring && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Repeat size={12} />
                Repeats {(RECUR_LABEL[events.find((e) => e.id === selected.id)?.recurrence?.split(":")[0] ?? ""] ?? "").toLowerCase()}
              </p>
            )}
            {selected.description && <p className="text-[13px] text-muted whitespace-pre-wrap">{selected.description}</p>}
            <div className="flex gap-2 flex-wrap pt-1">
              {selected.brightspaceUrl && (
                <a href={selected.brightspaceUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="secondary"><ExternalLink size={13} /> Open Brightspace</Button>
                </a>
              )}
              <Button size="sm" variant="secondary" onClick={() => {
                window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "reminder" } }));
                setSelected(null);
              }}>
                <Timer size={13} /> Add Reminder
              </Button>
              <Button size="sm" variant="secondary" onClick={() => {
                window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "note" } }));
                setSelected(null);
              }}>
                <StickyNote size={13} /> Add Note
              </Button>
              {selected.source === "manual" && selected.key.startsWith("e") && (
                <Button size="sm" variant="ghost" className="text-rose-600 dark:text-rose-400" onClick={async () => {
                  await fetch(`/api/events/${selected.id}`, { method: "DELETE" });
                  toast(selected.recurring ? "Event series deleted" : "Event deleted");
                  setSelected(null);
                  router.refresh();
                }}>
                  {selected.recurring ? "Delete series" : "Delete"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <AssignmentDrawer assignment={openA} onClose={() => setOpenA(null)} />
      <QuizDrawer quiz={openQ} onClose={() => setOpenQ(null)} />
    </div>
  );
}
