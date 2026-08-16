"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, MapPin, RotateCcw, StickyNote, Timer, Trash2 } from "lucide-react";
import { Badge, Button, Drawer, Label, Select, SourceBadge, toast } from "@/components/ui";
import type { QuizDTO } from "@/components/types";
import { cn, countdown, courseColor, fmtDate } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = { quiz: "Quiz", midterm: "Midterm", final: "Final Exam", exam: "Exam" };

export function QuizDrawer({
  quiz,
  onClose,
  onChanged,
}: {
  quiz: QuizDTO | null;
  onClose: () => void;
  onChanged?: (q: QuizDTO | null) => void;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<QuizDTO | null>(quiz);
  const [tick, setTick] = useState(0);

  useEffect(() => setCurrent(quiz), [quiz]);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  if (!current) return null;
  const overridden: string[] = current.overriddenFields ? JSON.parse(current.overriddenFields) : [];
  const cd = current.startAt ? countdown(current.startAt) : null;
  const cc = courseColor(current.course.color);

  async function patch(body: Record<string, unknown>) {
    if (!current) return;
    const res = await fetch(`/api/quizzes/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrent(data.quiz);
      onChanged?.(data.quiz);
      router.refresh();
    } else toast("Update failed", "error");
  }

  async function remove() {
    if (!current) return;
    if (!confirm(`Delete "${current.title}"?`)) return;
    await fetch(`/api/quizzes/${current.id}`, { method: "DELETE" });
    toast("Deleted");
    onChanged?.(null);
    onClose();
    router.refresh();
  }

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
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge tone={current.kind === "final" || current.kind === "midterm" ? "red" : "violet"}>
              {KIND_LABEL[current.kind] ?? current.kind}
            </Badge>
            {current.weight != null && current.weight > 0 && <Badge>{current.weight}%</Badge>}
            {current.durationMins != null && <Badge>{current.durationMins} min</Badge>}
          </div>
        </div>

        {cd && (
          <div className="rounded-lg border border-border-base bg-surface-2 p-3 text-center">
            <p className="text-lg font-semibold tabular-nums">{cd}</p>
            <p className="text-xs text-muted">{current.startAt ? fmtDate(current.startAt, true) : ""}</p>
          </div>
        )}

        {overridden.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[13px] font-medium text-amber-600 dark:text-amber-400 mb-1.5">Overridden — your edits differ from Brightspace</p>
            <p className="text-xs text-muted mb-2">Fields: {overridden.join(", ")}</p>
            <Button size="xs" variant="outline" onClick={() => patch({ restore: overridden })}>
              <RotateCcw size={12} /> Restore Brightspace values
            </Button>
          </div>
        )}

        <dl className="space-y-2 text-[13px]">
          {current.location && (
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-muted" />
              <span>{current.location}</span>
            </div>
          )}
          {current.topics && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-0.5">Topics</dt>
              <dd className="leading-relaxed">{current.topics}</dd>
            </div>
          )}
        </dl>

        <div>
          <Label htmlFor="qd-status">Status</Label>
          <Select id="qd-status" value={current.status} onChange={(e) => patch({ status: e.target.value })}>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("focus:start", {
                  detail: { label: `Study: ${current.title}`, minutes: 50, courseId: current.courseId },
                }),
              )
            }
          >
            <Timer size={14} /> Study Now
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
