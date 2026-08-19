"use client";

import { useCallback, useMemo, useState } from "react";
import { Eye, EyeOff, GripVertical, LayoutGrid, RotateCcw } from "lucide-react";
import { Button, Menu, toast } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  AnnouncementDTO, AssignmentDTO, CourseDTO, EventDTO, GradeItemDTO, NoteDTO,
  QuizDTO, StudySessionDTO, SyncLogDTO, TaskDTO, ToolDTO,
} from "@/components/types";
import { AssignmentDrawer } from "@/components/AssignmentDrawer";
import { QuizDrawer } from "@/components/QuizDrawer";
import {
  PriorityWidget, DeadlinesWidget, CoursesWidget, AnnouncementsWidget, SyncWidget, WhatsNewWidget,
} from "./widgets-core";
import { HeroToday } from "./Hero";
import {
  CalendarWidget, FocusWidget, GradeWidget, QuickNoteWidget, StudyWidget, ToolsWidget, WorkloadWidget,
} from "./widgets-productivity";

export interface PreferenceDTO {
  theme: string;
  widgetLayout: string | null;
  syncMode: string;
  syncIntervalMins: number;
  notificationPrefs: string | null;
  targetGrades: string | null;
  lastSeenFeedAt: string | null;
}

export interface DashboardData {
  userName: string;
  preference: PreferenceDTO | null;
  courses: CourseDTO[];
  assignments: AssignmentDTO[];
  quizzes: QuizDTO[];
  tasks: TaskDTO[];
  announcements: AnnouncementDTO[];
  events: EventDTO[];
  grades: GradeItemDTO[];
  sessions: StudySessionDTO[];
  lastSync: SyncLogDTO | null;
  tools: ToolDTO[];
  unreadByCourse: Record<string, number>;
  brightspaceEnabled: boolean;
  recentNotes?: NoteDTO[];
}

export interface WidgetCtx {
  data: DashboardData;
  courseFilter: string | null;
  openAssignment: (a: AssignmentDTO) => void;
  openQuiz: (q: QuizDTO) => void;
}

interface WidgetDef {
  id: string;
  title: string;
  span: 1 | 2 | 3; // of 3 columns on xl
  /** Opt-in widgets start hidden so the default dashboard stays calm. */
  optional?: boolean;
  render: (ctx: WidgetCtx) => React.ReactNode;
}

const WIDGETS: WidgetDef[] = [
  { id: "priority", title: "What to work on", span: 2, render: (ctx) => <PriorityWidget ctx={ctx} /> },
  { id: "deadlines", title: "Upcoming deadlines", span: 1, render: (ctx) => <DeadlinesWidget ctx={ctx} /> },
  { id: "calendar", title: "Calendar", span: 1, render: (ctx) => <CalendarWidget ctx={ctx} /> },
  { id: "announcements", title: "Announcements", span: 1, render: (ctx) => <AnnouncementsWidget ctx={ctx} /> },
  { id: "courses", title: "Courses", span: 3, render: (ctx) => <CoursesWidget ctx={ctx} /> },
  { id: "grades", title: "Grade planner", span: 1, optional: true, render: (ctx) => <GradeWidget ctx={ctx} /> },
  { id: "workload", title: "Workload", span: 1, optional: true, render: (ctx) => <WorkloadWidget ctx={ctx} /> },
  { id: "study", title: "Study progress", span: 1, optional: true, render: (ctx) => <StudyWidget ctx={ctx} /> },
  { id: "focus", title: "Focus timer", span: 1, optional: true, render: (ctx) => <FocusWidget ctx={ctx} /> },
  { id: "quicknote", title: "Quick note", span: 1, optional: true, render: (ctx) => <QuickNoteWidget ctx={ctx} /> },
  { id: "whatsnew", title: "What's new", span: 1, optional: true, render: (ctx) => <WhatsNewWidget ctx={ctx} /> },
  { id: "tools", title: "Quick tools", span: 1, optional: true, render: (ctx) => <ToolsWidget ctx={ctx} /> },
  { id: "sync", title: "Brightspace sync", span: 1, optional: true, render: (ctx) => <SyncWidget ctx={ctx} /> },
];

interface LayoutEntry {
  id: string;
  hidden?: boolean;
}

function defaultLayout(): LayoutEntry[] {
  return WIDGETS.map((w) => ({ id: w.id, hidden: w.optional }));
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const [layout, setLayout] = useState<LayoutEntry[]>(() => {
    try {
      const saved = data.preference?.widgetLayout ? (JSON.parse(data.preference.widgetLayout) as LayoutEntry[]) : null;
      if (!saved) return defaultLayout();
      const known = saved.filter((e) => WIDGETS.some((w) => w.id === e.id));
      const missing = WIDGETS.filter((w) => !known.some((e) => e.id === w.id)).map((w) => ({ id: w.id, hidden: w.optional }));
      return [...known, ...missing];
    } catch {
      return defaultLayout();
    }
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [openA, setOpenA] = useState<AssignmentDTO | null>(null);
  const [openQ, setOpenQ] = useState<QuizDTO | null>(null);

  const saveLayout = useCallback(async (next: LayoutEntry[]) => {
    setLayout(next);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetLayout: JSON.stringify(next) }),
    }).catch(() => {});
  }, []);

  const ctx: WidgetCtx = useMemo(
    () => ({ data, courseFilter, openAssignment: setOpenA, openQuiz: setOpenQ }),
    [data, courseFilter],
  );

  function move(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = [...layout];
    const from = next.findIndex((e) => e.id === dragId);
    const to = next.findIndex((e) => e.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveLayout(next);
    setDragId(null);
    setOverId(null);
  }

  function toggle(id: string) {
    saveLayout(layout.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)));
  }

  const visible = layout.filter((e) => !e.hidden);

  return (
    <div className="space-y-4">
      <HeroToday ctx={ctx} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Your board</p>
        <div className="flex items-center gap-2">
          <select
            value={courseFilter ?? ""}
            onChange={(e) => setCourseFilter(e.target.value || null)}
            className="h-8 rounded-lg border border-border-base bg-surface px-2 text-[13px]"
            aria-label="Filter dashboard by course"
          >
            <option value="">All courses</option>
            {data.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>

          <Menu
            trigger={
              <Button size="sm" variant="outline">
                <LayoutGrid size={13} /> Widgets
                <span className="text-faint tabular-nums">{visible.length}</span>
              </Button>
            }
          >
            <div className="w-64">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Show on dashboard
              </p>
              <div className="max-h-80 overflow-y-auto py-0.5">
                {layout.map((entry) => {
                  const def = WIDGETS.find((w) => w.id === entry.id);
                  if (!def) return null;
                  return (
                    <button
                      key={def.id}
                      onClick={() => toggle(def.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-left hover:bg-surface-2"
                    >
                      {entry.hidden ? (
                        <EyeOff size={13} className="text-faint shrink-0" />
                      ) : (
                        <Eye size={13} className="text-accent shrink-0" />
                      )}
                      <span className={cn("grow truncate", entry.hidden && "text-muted")}>{def.title}</span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border-base py-1">
                <button
                  onClick={() => { saveLayout(defaultLayout()); toast("Dashboard reset to default"); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-muted hover:bg-surface-2 hover:text-foreground"
                >
                  <RotateCcw size={13} /> Reset layout
                </button>
              </div>
              <p className="px-3 pb-2 pt-0.5 text-[11px] text-faint">
                Drag any widget by its handle to reorder.
              </p>
            </div>
          </Menu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {visible.map((entry) => {
          const def = WIDGETS.find((w) => w.id === entry.id);
          if (!def) return null;
          return (
            <section
              key={def.id}
              aria-label={def.title}
              onDragOver={(e) => { e.preventDefault(); setOverId(def.id); }}
              onDragLeave={() => setOverId((v) => (v === def.id ? null : v))}
              onDrop={() => move(def.id)}
              className={cn(
                def.span === 3 && "md:col-span-2 xl:col-span-3",
                def.span === 2 && "md:col-span-2 xl:col-span-2",
                "group/widget relative min-w-0",
                dragId === def.id && "widget-dragging",
                overId === def.id && dragId && dragId !== def.id && "widget-drop-target",
              )}
            >
              {/* Always available — no edit mode to enter first. */}
              <div
                draggable
                onDragStart={() => setDragId(def.id)}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                title={`Drag to reorder ${def.title}`}
                className="absolute -top-1.5 right-2 z-10 cursor-grab active:cursor-grabbing rounded-md border border-border-base bg-surface p-1 text-faint opacity-0 shadow-sm transition-opacity group-hover/widget:opacity-100 focus-visible:opacity-100 hover:text-foreground"
              >
                <GripVertical size={12} />
              </div>
              <button
                onClick={() => toggle(def.id)}
                title={`Hide ${def.title}`}
                aria-label={`Hide ${def.title}`}
                className="absolute -top-1.5 right-9 z-10 rounded-md border border-border-base bg-surface p-1 text-faint opacity-0 shadow-sm transition-opacity group-hover/widget:opacity-100 focus-visible:opacity-100 hover:text-foreground"
              >
                <EyeOff size={12} />
              </button>
              {def.render(ctx)}
            </section>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-strong p-8 text-center">
          <p className="text-sm font-medium">No widgets on your board</p>
          <p className="text-[13px] text-muted mt-1">Add some from the Widgets menu above.</p>
        </div>
      )}

      <AssignmentDrawer assignment={openA} onClose={() => setOpenA(null)} />
      <QuizDrawer quiz={openQ} onClose={() => setOpenQ(null)} />
    </div>
  );
}
