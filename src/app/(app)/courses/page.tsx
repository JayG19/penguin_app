import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, ProgressBar } from "@/components/ui";
import { NewCourseButton } from "./NewCourseButton";
import { courseColor, relativeDue, cn } from "@/lib/utils";
import { summarizeGrades } from "@/lib/grades";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses" };

export default async function CoursesPage() {
  const user = (await getSessionUser())!;
  const courses = await db.course.findMany({
    where: { userId: user.id, archived: false },
    include: {
      contacts: { where: { role: "professor" }, take: 1 },
      gradeItems: true,
      assignments: { where: { status: { notIn: ["completed", "submitted"] }, dueAt: { gte: new Date() } }, orderBy: { dueAt: "asc" }, take: 1 },
      quizzes: { where: { status: "upcoming", startAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, take: 1 },
      _count: { select: { announcements: { where: { read: false } } } },
    },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Courses</h1>
          <p className="text-[13px] text-muted">{courses.length} courses · {courses[0]?.term ?? ""}</p>
        </div>
        <NewCourseButton />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {courses.map((c) => {
          const cc = courseColor(c.color);
          const summary = summarizeGrades(c.gradeItems);
          const nextA = c.assignments[0];
          const nextQ = c.quizzes[0];
          const next =
            nextA && nextQ
              ? new Date(nextA.dueAt!) < new Date(nextQ.startAt!)
                ? { label: nextA.title, at: nextA.dueAt! }
                : { label: nextQ.title, at: nextQ.startAt! }
              : nextA
                ? { label: nextA.title, at: nextA.dueAt! }
                : nextQ
                  ? { label: nextQ.title, at: nextQ.startAt! }
                  : null;
          return (
            <Link key={c.id} href={`/courses/${c.id}`} className="group">
              <div className="rounded-xl border border-border-base bg-surface p-4 h-full hover:border-border-strong transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-semibold", cc.text)}>{c.code}</span>
                  <div className="flex gap-1.5 items-center">
                    {c._count.announcements > 0 && <Badge tone="accent">{c._count.announcements} unread</Badge>}
                    <Badge>{c.source === "brightspace" ? "Brightspace" : "Manual"}</Badge>
                  </div>
                </div>
                <h2 className="text-[15px] font-medium mt-1 group-hover:text-accent">{c.name}</h2>
                {c.contacts[0] && <p className="text-xs text-muted mt-0.5">{c.contacts[0].name}</p>}
                <div className="flex items-center justify-between text-xs mt-3 mb-1.5">
                  <span className="text-muted">Progress {Math.round(c.progress * 100)}%</span>
                  <span className="font-semibold tabular-nums">
                    {summary.currentGrade != null ? `${summary.currentGrade.toFixed(0)}%` : "No grades yet"}
                  </span>
                </div>
                <ProgressBar value={c.progress * 100} barClassName={cc.bar} />
                <p className="text-xs text-muted mt-3 truncate">
                  {next ? `Next: ${next.label} · ${relativeDue(next.at.toISOString())}` : "No upcoming deadlines"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
