import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardClient, type DashboardData } from "@/components/dashboard/DashboardClient";
import { brightspaceEnabled } from "@/lib/brightspace/config";

export const dynamic = "force-dynamic";

// Dates → ISO strings so client components get plain JSON
function serialize<T>(x: unknown): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export default async function DashboardPage() {
  const user = (await getSessionUser())!;
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 864e5);
  const monthAhead = new Date(now.getTime() + 45 * 864e5);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const [
    preference,
    courses,
    assignments,
    quizzes,
    tasks,
    announcements,
    events,
    grades,
    sessions,
    lastSync,
    pinnedTools,
    unreadByCourse,
  ] = await Promise.all([
    db.userPreference.findUnique({ where: { userId: user.id } }),
    db.course.findMany({ where: { userId: user.id, archived: false }, orderBy: { code: "asc" } }),
    db.assignment.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } }, submission: true },
      orderBy: { dueAt: "asc" },
    }),
    db.quiz.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: { startAt: "asc" },
    }),
    db.task.findMany({
      where: { userId: user.id },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: [{ completed: "asc" }, { dueAt: "asc" }],
    }),
    db.announcement.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: { postedAt: "desc" },
      take: 12,
    }),
    db.calendarEvent.findMany({
      where: { userId: user.id, startAt: { gte: new Date(dayStart.getTime() - 30 * 864e5), lte: monthAhead } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: { startAt: "asc" },
    }),
    db.gradeItem.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
    }),
    db.studySession.findMany({
      where: { userId: user.id, startedAt: { gte: new Date(now.getTime() - 28 * 864e5) } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: { startedAt: "desc" },
    }),
    db.syncLog.findFirst({ where: { userId: user.id }, orderBy: { startedAt: "desc" } }),
    db.tool.findMany({ where: { userId: user.id, pinned: true }, orderBy: { order: "asc" }, take: 9 }),
    db.announcement.groupBy({
      by: ["courseId"],
      where: { course: { userId: user.id }, read: false },
      _count: true,
    }),
  ]);

  void weekAhead;

  const data: DashboardData = {
    userName: user.name,
    preference: serialize(preference),
    courses: serialize(courses),
    assignments: serialize(assignments),
    quizzes: serialize(quizzes),
    tasks: serialize(tasks),
    announcements: serialize(announcements),
    events: serialize(events),
    grades: serialize(grades),
    sessions: serialize(sessions),
    lastSync: serialize(lastSync),
    tools: serialize(pinnedTools),
    unreadByCourse: Object.fromEntries(unreadByCourse.map((u) => [u.courseId, u._count])),
    brightspaceEnabled: brightspaceEnabled(),
  };

  return <DashboardClient data={data} />;
}
