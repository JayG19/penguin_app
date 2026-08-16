import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { CourseDTO, NoteDTO } from "@/components/types";
import { NotesClient } from "./NotesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = (await getSessionUser())!;
  const [notes, courses, assignments, quizzes] = await Promise.all([
    db.note.findMany({
      where: { userId: user.id },
      include: {
        course: { select: { id: true, code: true, name: true, color: true } },
        assignment: { select: { id: true, title: true } },
        quiz: { select: { id: true, title: true } },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    db.course.findMany({ where: { userId: user.id, archived: false }, orderBy: { code: "asc" } }),
    db.assignment.findMany({ where: { course: { userId: user.id } }, select: { id: true, title: true, courseId: true } }),
    db.quiz.findMany({ where: { course: { userId: user.id } }, select: { id: true, title: true, courseId: true } }),
  ]);
  return (
    <NotesClient
      notes={serialize<NoteDTO[]>(notes)}
      courses={serialize<CourseDTO[]>(courses)}
      assignments={serialize(assignments)}
      quizzes={serialize(quizzes)}
    />
  );
}
