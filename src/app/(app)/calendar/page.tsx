import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AssignmentDTO, CourseDTO, EventDTO, QuizDTO, TaskDTO } from "@/components/types";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = (await getSessionUser())!;
  const [events, assignments, quizzes, tasks, courses] = await Promise.all([
    db.calendarEvent.findMany({
      where: { userId: user.id },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
    }),
    db.assignment.findMany({
      where: { course: { userId: user.id }, dueAt: { not: null } },
      include: { course: { select: { id: true, code: true, name: true, color: true } }, submission: true },
    }),
    db.quiz.findMany({
      where: { course: { userId: user.id }, startAt: { not: null } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
    }),
    db.task.findMany({
      where: { userId: user.id, dueAt: { not: null } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
    }),
    db.course.findMany({ where: { userId: user.id, archived: false }, orderBy: { code: "asc" } }),
  ]);

  return (
    <CalendarClient
      events={serialize<EventDTO[]>(events)}
      assignments={serialize<AssignmentDTO[]>(assignments)}
      quizzes={serialize<QuizDTO[]>(quizzes)}
      tasks={serialize<TaskDTO[]>(tasks)}
      courses={serialize<CourseDTO[]>(courses)}
    />
  );
}
