"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FileQuestion, MapPin, Plus } from "lucide-react";
import { Badge, Button, Card, EmptyState, Segmented, Select, SourceBadge } from "@/components/ui";
import { QuizDrawer } from "@/components/QuizDrawer";
import type { CourseDTO, QuizDTO } from "@/components/types";
import { cn, countdown, courseColor, fmtDate } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = { quiz: "Quiz", midterm: "Midterm", final: "Final", exam: "Exam" };

export function QuizzesClient({ quizzes, courses }: { quizzes: QuizDTO[]; courses: CourseDTO[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [courseFilter, setCourseFilter] = useState("");
  const [view, setView] = useState<"upcoming" | "past" | "all">("upcoming");
  const [open, setOpen] = useState<QuizDTO | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const openId = params.get("open");
    if (openId) {
      const found = quizzes.find((x) => x.id === openId);
      if (found) setOpen(found);
    }
  }, [params, quizzes]);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return quizzes
      .filter((q) => !courseFilter || q.courseId === courseFilter)
      .filter((q) => {
        if (view === "all") return true;
        const upcoming = q.status === "upcoming" && (!q.startAt || new Date(q.startAt) >= now);
        return view === "upcoming" ? upcoming : !upcoming;
      })
      .sort((a, b) => {
        if (!a.startAt) return 1;
        if (!b.startAt) return -1;
        return view === "past"
          ? new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
          : new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      });
  }, [quizzes, courseFilter, view]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Quizzes & Exams</h1>
          <p className="text-[13px] text-muted">
            {quizzes.filter((q) => q.status === "upcoming" && q.startAt && new Date(q.startAt) > new Date()).length} upcoming assessments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "quiz" } }))}>
            <Plus size={14} /> Quiz
          </Button>
          <Button variant="primary" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "exam" } }))}>
            <Plus size={14} /> Exam
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Segmented
          options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }, { value: "all", label: "All" }]}
          value={view}
          onChange={setView}
        />
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-auto" aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileQuestion size={28} />}
            title={view === "upcoming" ? "No upcoming assessments" : "Nothing here"}
            hint={view === "upcoming" ? "You're all caught up 🎉 Add exams that aren't in Brightspace." : undefined}
            actions={
              <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "exam" } }))}>
                Add Exam
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((q) => {
            const cd = q.startAt ? countdown(q.startAt) : null;
            const cc = courseColor(q.course.color);
            const heavy = (q.weight ?? 0) >= 20;
            return (
              <Card
                key={q.id}
                className="p-4 cursor-pointer hover:border-border-strong transition-colors"
                onClick={() => setOpen(q)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setOpen(q)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold", cc.text)}>{q.course.code}</span>
                      <Badge tone={heavy ? "red" : q.kind === "quiz" ? "violet" : "amber"}>{KIND_LABEL[q.kind] ?? q.kind}</Badge>
                    </div>
                    <h3 className="text-[14px] font-medium mt-1 truncate">{q.title}</h3>
                  </div>
                  <SourceBadge source={q.source} />
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="text-xs text-muted space-y-0.5">
                    <p>{q.startAt ? fmtDate(q.startAt, true) : "Date TBD"}{q.durationMins ? ` · ${q.durationMins} min` : ""}</p>
                    {q.location && <p className="flex items-center gap-1"><MapPin size={11} /> {q.location}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {q.weight != null && q.weight > 0 && <p className="text-sm font-semibold tabular-nums">{q.weight}%</p>}
                    {cd && <p className={cn("text-xs tabular-nums", heavy ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted")}>{cd}</p>}
                    {q.status !== "upcoming" && <Badge tone={q.status === "completed" ? "green" : "red"}>{q.status}</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <QuizDrawer
        quiz={open}
        onClose={() => {
          setOpen(null);
          if (params.get("open")) router.replace("/quizzes");
        }}
      />
    </div>
  );
}
