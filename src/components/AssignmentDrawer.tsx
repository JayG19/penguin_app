"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, RotateCcw, StickyNote, Timer, Trash2 } from "lucide-react";
import { Badge, Button, Drawer, Label, PriorityBadge, Select, SourceBadge, Textarea, toast } from "@/components/ui";
import type { AssignmentDTO } from "@/components/types";
import { computePriority } from "@/lib/priority";
import { cn, courseColor, fmtDate, relativeDue } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "submitted", label: "Submitted" },
  { value: "overdue", label: "Overdue" },
];

const SUBMISSION_OPTIONS = [
  { value: "not_submitted", label: "Not submitted" },
  { value: "submitted", label: "Submitted" },
  { value: "late", label: "Late" },
  { value: "graded", label: "Graded" },
  { value: "returned", label: "Returned" },
];

export function AssignmentDrawer({
  assignment,
  onClose,
  onChanged,
}: {
  assignment: AssignmentDTO | null;
  onClose: () => void;
  onChanged?: (a: AssignmentDTO | null) => void;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<AssignmentDTO | null>(assignment);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    setCurrent(assignment);
    setNoteDraft(assignment?.notes ?? "");
  }, [assignment]);

  if (!current) return null;

  const overridden: string[] = current.overriddenFields ? JSON.parse(current.overriddenFields) : [];
  const priority = computePriority({
    dueAt: current.dueAt,
    weight: current.weight,
    completionPct: current.completionPct,
    estimatedHours: current.estimatedHours,
    priorityOverride: current.priorityOverride,
    completed: ["completed", "submitted"].includes(current.status),
  });

  async function patch(body: Record<string, unknown>, refresh = true) {
    if (!current) return;
    const res = await fetch(`/api/assignments/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrent(data.assignment);
      onChanged?.(data.assignment);
      if (refresh) router.refresh();
    } else {
      toast("Update failed", "error");
    }
  }

  async function patchSubmission(status: string) {
    if (!current) return;
    const res = await fetch(`/api/submissions/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast("Submission status updated");
      const sub = (await res.json()).submission;
      const next = { ...current, submission: sub };
      setCurrent(next);
      onChanged?.(next);
      router.refresh();
    }
  }

  async function remove() {
    if (!current) return;
    if (!confirm(`Delete "${current.title}"?`)) return;
    await fetch(`/api/assignments/${current.id}`, { method: "DELETE" });
    toast("Assignment deleted");
    onChanged?.(null);
    onClose();
    router.refresh();
  }

  const cc = courseColor(current.course.color);

  return (
    <Drawer open onClose={onClose} title={
      <span className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", cc.dot)} />
        {current.course.code}
      </span>
    }>
      <div className="space-y-5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold leading-snug">{current.title}</h2>
            <SourceBadge source={current.source} />
          </div>
          <p className="text-[13px] text-muted mt-1">
            {relativeDue(current.dueAt)}
            {current.dueAt ? ` · ${fmtDate(current.dueAt, true)}` : ""}
            {current.weight != null ? ` · ${current.weight}% of grade` : ""}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <PriorityBadge priority={priority} overridden={!!current.priorityOverride} />
            {current.estimatedHours != null && <Badge>~{current.estimatedHours}h</Badge>}
            {current.difficulty != null && <Badge>difficulty {current.difficulty}/5</Badge>}
          </div>
        </div>

        {overridden.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400 mb-1.5">
              Overridden — your edits differ from Brightspace
            </p>
            <p className="text-xs text-muted mb-2">Fields: {overridden.join(", ")}</p>
            <Button size="xs" variant="outline" onClick={() => patch({ restore: overridden })}>
              <RotateCcw size={12} /> Restore Brightspace values
            </Button>
          </div>
        )}

        {current.description && (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Description</h3>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{current.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ad-status">Status</Label>
            <Select id="ad-status" value={current.status} onChange={(e) => patch({ status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="ad-priority">Priority</Label>
            <Select
              id="ad-priority"
              value={current.priorityOverride ?? "auto"}
              onChange={(e) => patch({ priorityOverride: e.target.value === "auto" ? null : e.target.value })}
            >
              <option value="auto">Auto ({computePriority({ ...current, priorityOverride: null, completed: false })})</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="ad-completion">Completion — {current.completionPct}%</Label>
          <input
            id="ad-completion"
            type="range"
            min={0}
            max={100}
            step={5}
            value={current.completionPct}
            onChange={(e) => setCurrent({ ...current, completionPct: Number(e.target.value) })}
            onMouseUp={() => patch({ completionPct: current.completionPct })}
            onTouchEnd={() => patch({ completionPct: current.completionPct })}
            className="w-full accent-[var(--accent)]"
          />
        </div>

        <div>
          <Label htmlFor="ad-sub">Submission</Label>
          <Select id="ad-sub" value={current.submission?.status ?? "not_submitted"} onChange={(e) => patchSubmission(e.target.value)}>
            {SUBMISSION_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          {current.submission?.submittedAt && (
            <p className="text-xs text-muted mt-1">Submitted {fmtDate(current.submission.submittedAt, true)}</p>
          )}
          {current.submission?.grade && (
            <p className="text-xs mt-1">Grade: <span className="font-medium">{current.submission.grade}</span></p>
          )}
          {current.submission?.feedback && (
            <p className="text-xs text-muted mt-1 italic">&ldquo;{current.submission.feedback}&rdquo;</p>
          )}
        </div>

        <div>
          <Label htmlFor="ad-notes">Notes</Label>
          <Textarea id="ad-notes" rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Quick notes about this assignment…" />
          {noteDraft !== (current.notes ?? "") && (
            <Button size="xs" variant="secondary" className="mt-1.5" onClick={() => { patch({ notes: noteDraft }, false); toast("Notes saved"); }}>
              Save notes
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {!["completed", "submitted"].includes(current.status) && (
            <Button variant="primary" size="sm" onClick={() => { patch({ status: "completed" }); toast("Marked complete 🎉"); }}>
              Mark Complete
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("focus:start", {
                  detail: { label: current.title, minutes: 25, courseId: current.courseId, assignmentId: current.id },
                }),
              )
            }
          >
            <Timer size={14} /> Start Focus
          </Button>
          {current.brightspaceUrl && (
            <a href={current.brightspaceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm"><ExternalLink size={14} /> Open Brightspace</Button>
            </a>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "note", courseId: current.courseId } }))}
          >
            <StickyNote size={14} /> Add Note
          </Button>
          <Button variant="ghost" size="sm" onClick={remove} className="text-rose-600 dark:text-rose-400">
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
