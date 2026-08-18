"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge, Button, Drawer, Input, Label, Select, SourceBadge, Textarea, toast } from "@/components/ui";
import { RemindButton } from "@/components/nudges/RemindButton";
import type { AssignmentDTO } from "@/components/types";
import { cn, courseColor, fmtDate, relativeDue } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "not_submitted", label: "Not submitted" },
  { value: "submitted", label: "Submitted" },
  { value: "late", label: "Late" },
  { value: "graded", label: "Graded" },
  { value: "returned", label: "Returned" },
];

const STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "blue" | "violet"> = {
  not_submitted: "neutral", submitted: "green", late: "amber", graded: "blue", returned: "violet",
};

/**
 * Submission-focused counterpart to the assignment drawer: everything about
 * handing the work in (status, timestamp, grade, feedback, dropbox link),
 * without the planning fields that belong on the assignment itself.
 */
export function SubmissionDrawer({
  assignment,
  onClose,
}: {
  assignment: AssignmentDTO | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<AssignmentDTO | null>(assignment);
  const [feedbackDraft, setFeedbackDraft] = useState("");

  useEffect(() => {
    setCurrent(assignment);
    setFeedbackDraft(assignment?.submission?.feedback ?? "");
  }, [assignment]);

  if (!current) return null;
  const sub = current.submission;
  const status = sub?.status ?? "not_submitted";
  const cc = courseColor(current.course.color);
  const overridden: string[] = sub?.overriddenFields ? JSON.parse(sub.overriddenFields) : [];
  const late = !!(current.dueAt && sub?.submittedAt && new Date(sub.submittedAt) > new Date(current.dueAt));

  async function patch(body: Record<string, unknown>, message?: string) {
    if (!current) return;
    const res = await fetch(`/api/submissions/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const submission = (await res.json()).submission;
      setCurrent({ ...current, submission });
      if (message) toast(message);
      router.refresh();
    } else {
      toast("Update failed", "error");
    }
  }

  const submittedValue = sub?.submittedAt ? format(new Date(sub.submittedAt), "yyyy-MM-dd'T'HH:mm") : "";

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", cc.dot)} />
          {current.course.code}
        </span>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold leading-snug">{current.title}</h2>
            <SourceBadge source={sub?.source ?? current.source} />
          </div>
          <p className="text-[13px] text-muted mt-1">
            Due {current.dueAt ? fmtDate(current.dueAt, true) : "—"}
            {current.weight != null ? ` · ${current.weight}% of grade` : ""}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge tone={STATUS_TONE[status]}>{STATUS_OPTIONS.find((s) => s.value === status)?.label}</Badge>
            {late && <Badge tone="amber">Submitted after the deadline</Badge>}
            {status === "not_submitted" && current.dueAt && <Badge tone="neutral">{relativeDue(current.dueAt)}</Badge>}
          </div>
        </div>

        {overridden.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400 mb-1.5">
              Overridden — your edits differ from Brightspace
            </p>
            <p className="text-xs text-muted mb-2">Fields: {overridden.join(", ")}</p>
            <Button size="xs" variant="outline" onClick={() => patch({ restore: overridden }, "Restored Brightspace values")}>
              <RotateCcw size={12} /> Restore Brightspace values
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sd-status">Submission status</Label>
            <Select id="sd-status" value={status} onChange={(e) => patch({ status: e.target.value }, "Status updated")}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="sd-when">Submitted at</Label>
            <Input
              id="sd-when"
              type="datetime-local"
              value={submittedValue}
              onChange={(e) => patch({ submittedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="sd-grade">Grade</Label>
          <Input
            id="sd-grade"
            defaultValue={sub?.grade ?? ""}
            placeholder="e.g. 17/20 or A-"
            onBlur={(e) => e.target.value !== (sub?.grade ?? "") && patch({ grade: e.target.value || null }, "Grade saved")}
          />
        </div>

        <div>
          <Label htmlFor="sd-feedback">Feedback</Label>
          <Textarea
            id="sd-feedback"
            rows={4}
            value={feedbackDraft}
            onChange={(e) => setFeedbackDraft(e.target.value)}
            placeholder="Notes from your professor or TA…"
          />
          {feedbackDraft !== (sub?.feedback ?? "") && (
            <Button size="xs" variant="secondary" className="mt-1.5" onClick={() => patch({ feedback: feedbackDraft || null }, "Feedback saved")}>
              Save feedback
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {status === "not_submitted" && (
            <Button variant="primary" size="sm" onClick={() => patch({ status: "submitted" }, "Marked as submitted ✓")}>
              <Upload size={14} /> Mark Submitted
            </Button>
          )}
          {(current.brightspaceUrl || sub?.brightspaceUrl) && (
            <a href={sub?.brightspaceUrl ?? current.brightspaceUrl ?? "#"} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm"><ExternalLink size={14} /> Open Dropbox</Button>
            </a>
          )}
          <RemindButton
            title={`Submit ${current.course.code}: ${current.title}`}
            entityType="assignment"
            entityId={current.id}
            dueAt={current.dueAt}
          />
          {sub && sub.source === "manual" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 dark:text-rose-400"
              onClick={() => patch({ status: "not_submitted", submittedAt: null, grade: null, feedback: null }, "Submission reset")}
            >
              <Trash2 size={14} /> Reset
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
