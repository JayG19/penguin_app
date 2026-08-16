import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

export interface SearchResult {
  type: "course" | "assignment" | "quiz" | "note" | "announcement" | "contact" | "resource" | "task" | "event";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export const GET = withAuth(async (req, user) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return ok({ results: [] });

  const courseScope = { course: { userId: user.id } };
  const [courses, assignments, quizzes, notes, announcements, contacts, resources, tasks, events] = await Promise.all([
    db.course.findMany({ where: { userId: user.id, OR: [{ name: { contains: q } }, { code: { contains: q } }] }, take: 5 }),
    db.assignment.findMany({ where: { ...courseScope, title: { contains: q } }, include: { course: true }, take: 6 }),
    db.quiz.findMany({ where: { ...courseScope, title: { contains: q } }, include: { course: true }, take: 5 }),
    db.note.findMany({ where: { userId: user.id, OR: [{ title: { contains: q } }, { body: { contains: q } }] }, take: 5 }),
    db.announcement.findMany({ where: { ...courseScope, OR: [{ title: { contains: q } }, { body: { contains: q } }] }, include: { course: true }, take: 5 }),
    db.contact.findMany({ where: { ...courseScope, name: { contains: q } }, include: { course: true }, take: 5 }),
    db.resource.findMany({ where: { OR: [{ course: { userId: user.id } }, { courseId: null }], title: { contains: q } }, take: 4 }),
    db.task.findMany({ where: { userId: user.id, title: { contains: q } }, take: 5 }),
    db.calendarEvent.findMany({ where: { userId: user.id, title: { contains: q } }, take: 4 }),
  ]);

  const results: SearchResult[] = [
    ...courses.map((c) => ({ type: "course" as const, id: c.id, title: `${c.code} — ${c.name}`, href: `/courses/${c.id}` })),
    ...assignments.map((a) => ({ type: "assignment" as const, id: a.id, title: a.title, subtitle: a.course.code, href: `/assignments?open=${a.id}` })),
    ...quizzes.map((x) => ({ type: "quiz" as const, id: x.id, title: x.title, subtitle: x.course.code, href: `/quizzes?open=${x.id}` })),
    ...notes.map((n) => ({ type: "note" as const, id: n.id, title: n.title, href: `/notes?open=${n.id}` })),
    ...announcements.map((a) => ({ type: "announcement" as const, id: a.id, title: a.title, subtitle: a.course.code, href: `/announcements?open=${a.id}` })),
    ...contacts.map((c) => ({ type: "contact" as const, id: c.id, title: c.name, subtitle: c.course.code, href: `/contacts` })),
    ...resources.map((r) => ({ type: "resource" as const, id: r.id, title: r.title, href: r.url })),
    ...tasks.map((t) => ({ type: "task" as const, id: t.id, title: t.title, href: `/dashboard` })),
    ...events.map((e) => ({ type: "event" as const, id: e.id, title: e.title, href: `/calendar` })),
  ];
  return ok({ results: results.slice(0, 20) });
});
