"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, GripVertical, RotateCcw, Settings2 } from "lucide-react";
import { Button, toast } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  AnnouncementDTO, AssignmentDTO, CourseDTO, EventDTO, GradeItemDTO, NoteDTO,
  QuizDTO, StudySessionDTO, SyncLogDTO, TaskDTO, ToolDTO,
} from "@/components/types";
import { AssignmentDrawer } from "@/components/AssignmentDrawer";
import { QuizDrawer } from "@/components/QuizDrawer";
import {
  TodayWidget, PriorityWidget, DeadlinesWidget, CoursesWidget, AnnouncementsWidget, SyncWidget, WhatsNewWidget,
} from "./widgets-core";
import {
  CalendarWidget, FocusWidget, GradeWidget, QuickCaptureWidget, QuickNoteWidget, StudyWidget, ToolsWidget, WorkloadWidget,
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
  render: (ctx: WidgetCtx) => React.ReactNode;
}

const WIDGETS: WidgetDef[] = [
  { id: "today", title: "Today", span: 2, render: (ctx) => <TodayWidget ctx={ctx} /> },
  { id: "sync", title: "Brightspace Sync", span: 1, render: (ctx) => <SyncWidget ctx={ctx} /> },
  { id: "priority", title: "What Should I Work On?", span: 2, render: (ctx) => <PriorityWidget ctx={ctx} /> },
  { id: "capture", title: "Quick Capture", span: 1, render: (ctx) => <QuickCaptureWidget ctx={ctx} /> },
  { id: "deadlines", title: "Upcoming Deadlines", span: 1, render: (ctx) => <DeadlinesWidget ctx={ctx} /> },
  { id: "calendar", title: "Calendar", span: 1, render: (ctx) => <CalendarWidget ctx={ctx} /> },
  { id: "announcements", title: "Announcements", span: 1, render: (ctx) => <AnnouncementsWidget ctx={ctx} /> },
  { id: "courses", title: "Courses", span: 3, render: (ctx) => <CoursesWidget ctx={ctx} /> },
  { id: "grades", title: "Grade Planner", span: 1, render: (ctx) => <GradeWidget ctx={ctx} /> },
  { id: "workload", title: "Workload — Next 7 Days", span: 1, render: (ctx) => <WorkloadWidget ctx={ctx} /> },
  { id: "study", title: "Study Progress", span: 1, render: (ctx) => <StudyWidget ctx={ctx} /> },
  { id: "focus", title: "Focus Timer", span: 1, render: (ctx) => <FocusWidget ctx={ctx} /> },
  { id: "quicknote", title: "Quick Note", span: 1, render: (ctx) => <QuickNoteWidget ctx={ctx} /> },
  { id: "whatsnew", title: "What's New", span: 1, render: (ctx) => <WhatsNewWidget ctx={ctx} /> },
  { id: "tools", title: "Quick Tools", span: 1, render: (ctx) => <ToolsWidget ctx={ctx} /> },
];

interface LayoutEntry {
  id: string;
  hidden?: boolean;
}

function defaultLayout(): LayoutEntry[] {
  return WIDGETS.map((w) => ({ id: w.id }));
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const [layout, setLayout] = useState<LayoutEntry[]>(() => {
    try {
      const saved = data.preference?.widgetLayout ? (JSON.parse(data.preference.widgetLayout) as LayoutEntry[]) : null;
      if (!saved) return defaultLayout();
      const known = saved.filter((e) => WIDGETS.some((w) => w.id === e.id));
      const missing = WIDGETS.filter((w) => !known.some((e) => e.id === w.id)).map((w) => ({ id: w.id }));
      return [...known, ...missing];
    } catch {
      return defaultLayout();
    }
  });
  const [customizing, setCustomizing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
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

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = [...layout];
    const from = next.findIndex((e) => e.id === dragId);
    const to = next.findIndex((e) => e.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveLayout(next);
    setDragId(null);
  }

  // Derived from the viewer's clock, which the server can't know: rendered
  // after mount so SSR and hydration agree regardless of server timezone.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {greeting}, {data.userName.split(" ")[0]}
          </h1>
          <p className="text-[13px] text-muted">Here&apos;s what&apos;s happening across your courses.</p>
        </div>
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
          {customizing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => saveLayout(defaultLayout())}>
                <RotateCcw size={13} /> Reset
              </Button>
              <Button size="sm" variant="primary" onClick={() => { setCustomizing(false); toast("Dashboard layout saved"); }}>
                <Check size={13} /> Done
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCustomizing(true)}>
              <Settings2 size={13} /> Customize
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {layout.map((entry) => {
          const def = WIDGETS.find((w) => w.id === entry.id);
          if (!def) return null;
          if (entry.hidden && !customizing) return null;
          return (
            <section
              key={def.id}
              aria-label={def.title}
              draggable={customizing}
              onDragStart={() => setDragId(def.id)}
              onDragOver={(e) => customizing && e.preventDefault()}
              onDrop={() => onDrop(def.id)}
              className={cn(
                def.span === 3 && "md:col-span-2 xl:col-span-3",
                def.span === 2 && "md:col-span-2 xl:col-span-2",
                "min-w-0 relative",
                customizing && "cursor-grab",
                entry.hidden && "opacity-45",
              )}
            >
              {customizing && (
                <div className="absolute -top-2 right-2 z-10 flex gap-1">
                  <button
                    onClick={() => saveLayout(layout.map((e) => (e.id === def.id ? { ...e, hidden: !e.hidden } : e)))}
                    className="rounded-md border border-border-base bg-surface p-1 text-muted hover:text-foreground shadow-sm"
                    aria-label={entry.hidden ? `Show ${def.title}` : `Hide ${def.title}`}
                  >
                    {entry.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <span className="rounded-md border border-border-base bg-surface p-1 text-muted shadow-sm">
                    <GripVertical size={13} />
                  </span>
                </div>
              )}
              {def.render(ctx)}
            </section>
          );
        })}
      </div>

      <AssignmentDrawer assignment={openA} onClose={() => setOpenA(null)} />
      <QuizDrawer quiz={openQ} onClose={() => setOpenQ(null)} />
    </div>
  );
}
