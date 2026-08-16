"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Search } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, PriorityBadge, ProgressBar, Select, SourceBadge } from "@/components/ui";
import { AssignmentDrawer } from "@/components/AssignmentDrawer";
import type { AssignmentDTO, CourseDTO } from "@/components/types";
import { computePriority } from "@/lib/priority";
import { cn, courseColor, relativeDue } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  submitted: "Submitted",
  overdue: "Overdue",
};

const STATUS_TONE: Record<string, "neutral" | "blue" | "green" | "amber" | "red"> = {
  not_started: "neutral",
  in_progress: "blue",
  completed: "green",
  submitted: "green",
  overdue: "red",
};

export function AssignmentsClient({ assignments, courses }: { assignments: AssignmentDTO[]; courses: CourseDTO[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AssignmentDTO | null>(null);

  useEffect(() => {
    const openId = params.get("open");
    if (openId) {
      const found = assignments.find((a) => a.id === openId);
      if (found) setOpen(found);
    }
  }, [params, assignments]);

  const effectiveStatus = (a: AssignmentDTO) =>
    a.dueAt && new Date(a.dueAt) < new Date() && !["completed", "submitted"].includes(a.status) ? "overdue" : a.status;

  const filtered = useMemo(() => {
    return assignments
      .filter((a) => !courseFilter || a.courseId === courseFilter)
      .filter((a) => !statusFilter || effectiveStatus(a) === statusFilter)
      .filter((a) => !q || a.title.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        const doneA = ["completed", "submitted"].includes(a.status) ? 1 : 0;
        const doneB = ["completed", "submitted"].includes(b.status) ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [assignments, courseFilter, statusFilter, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Assignments</h1>
          <p className="text-[13px] text-muted">{filtered.filter((a) => !["completed", "submitted"].includes(a.status)).length} open · {assignments.length} total</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "assignment" } }))}>
          <Plus size={14} /> New Assignment
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative grow max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assignments…" className="pl-8" aria-label="Search assignments" />
        </div>
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-auto" aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={28} />}
            title="No assignments match"
            hint={assignments.length === 0 ? "Sync Brightspace or add your first assignment." : "Try clearing the filters."}
            actions={
              <>
                <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "assignment" } }))}>Add Assignment</Button>
                <Button size="sm" variant="outline" onClick={async () => { await fetch("/api/sync", { method: "POST" }); router.refresh(); }}>Sync Brightspace</Button>
              </>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const status = effectiveStatus(a);
            const days = a.dueAt ? differenceInCalendarDays(new Date(a.dueAt), new Date()) : null;
            const urgent = days != null && days <= 2 && !["completed", "submitted"].includes(a.status);
            const priority = computePriority({ ...a, completed: ["completed", "submitted"].includes(a.status) });
            const cc = courseColor(a.course.color);
            return (
              <Card
                key={a.id}
                className={cn(
                  "px-4 py-3 cursor-pointer hover:border-border-strong transition-colors",
                  urgent && "border-l-2 border-l-rose-500",
                )}
                onClick={() => setOpen(a)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setOpen(a)}
              >
                <div className="flex items-center gap-3">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", cc.dot)} aria-hidden />
                  <div className="min-w-0 grow">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={cn("text-xs font-semibold", cc.text)}>{a.course.code}</span>
                      <span className="text-[14px] font-medium truncate">{a.title}</span>
                    </div>
                    <p className={cn("text-xs mt-0.5", urgent ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted")}>
                      {relativeDue(a.dueAt)}
                      {a.weight != null ? ` · ${a.weight}%` : ""}
                      {a.estimatedHours != null ? ` · ~${a.estimatedHours}h` : ""}
                    </p>
                  </div>
                  <div className="hidden sm:block w-24 shrink-0">
                    <ProgressBar value={a.completionPct} />
                    <p className="text-[10px] text-faint mt-0.5 text-right tabular-nums">{a.completionPct}%</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={priority} overridden={!!a.priorityOverride} />
                    <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                    <span className="hidden md:inline-flex"><SourceBadge source={a.source} /></span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AssignmentDrawer
        assignment={open}
        onClose={() => {
          setOpen(null);
          if (params.get("open")) router.replace("/assignments");
        }}
      />
    </div>
  );
}
