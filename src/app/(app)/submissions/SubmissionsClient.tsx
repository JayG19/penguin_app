"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Badge, Card, EmptyState, Select, SourceBadge, toast } from "@/components/ui";
import type { AssignmentDTO, CourseDTO } from "@/components/types";
import { cn, courseColor, fmtDate } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  not_submitted: "Not submitted",
  submitted: "Submitted",
  late: "Late",
  graded: "Graded",
  returned: "Returned",
};

const STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "blue" | "violet"> = {
  not_submitted: "neutral", submitted: "green", late: "amber", graded: "blue", returned: "violet",
};

export function SubmissionsClient({ assignments, courses }: { assignments: AssignmentDTO[]; courses: CourseDTO[] }) {
  const router = useRouter();
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const rows = useMemo(
    () =>
      assignments
        .filter((a) => !courseFilter || a.courseId === courseFilter)
        .filter((a) => !statusFilter || (a.submission?.status ?? "not_submitted") === statusFilter),
    [assignments, courseFilter, statusFilter],
  );

  async function setStatus(a: AssignmentDTO, status: string) {
    const res = await fetch(`/api/submissions/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast("Submission status updated");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Submission Tracker</h1>
        <p className="text-[13px] text-muted">Dropbox status, grades and feedback for every assignment.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-auto" aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={<ClipboardCheck size={28} />} title="No submissions match" /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border-base">
                <th className="px-4 py-2.5 font-semibold">Assignment</th>
                <th className="px-2 py-2.5 font-semibold">Due</th>
                <th className="px-2 py-2.5 font-semibold">Submitted</th>
                <th className="px-2 py-2.5 font-semibold">Status</th>
                <th className="px-2 py-2.5 font-semibold text-right">Grade</th>
                <th className="px-4 py-2.5 font-semibold text-right">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const sub = a.submission;
                const status = sub?.status ?? "not_submitted";
                return (
                  <tr key={a.id} className="border-b border-border-base last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", courseColor(a.course.color).dot)} />
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-52">{a.title}</p>
                          <p className="text-[11px] text-muted">{a.course.code}</p>
                        </div>
                        <span className="hidden lg:inline-flex"><SourceBadge source={sub?.source ?? a.source} /></span>
                      </div>
                      {sub?.feedback && <p className="text-[11px] text-muted italic mt-1 max-w-72 truncate">&ldquo;{sub.feedback}&rdquo;</p>}
                    </td>
                    <td className="px-2 py-2.5 text-muted whitespace-nowrap">{a.dueAt ? fmtDate(a.dueAt) : "—"}</td>
                    <td className="px-2 py-2.5 text-muted whitespace-nowrap">{sub?.submittedAt ? fmtDate(sub.submittedAt, true) : "—"}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                        <select
                          value={status}
                          onChange={(e) => setStatus(a, e.target.value)}
                          className="h-6 rounded border border-border-base bg-surface text-[11px] px-1"
                          aria-label={`Update status for ${a.title}`}
                        >
                          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-medium tabular-nums whitespace-nowrap">{sub?.grade ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {a.brightspaceUrl ? (
                        <a href={a.brightspaceUrl} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent inline-block" aria-label="Open dropbox in Brightspace">
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
