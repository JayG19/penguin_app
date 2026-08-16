import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { CourseDTO, QuizDTO } from "@/components/types";
import { QuizzesClient } from "./QuizzesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quizzes & Exams" };

export default async function QuizzesPage() {
  const user = (await getSessionUser())!;
  const [quizzes, courses] = await Promise.all([
    db.quiz.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: { startAt: "asc" },
    }),
    db.course.findMany({ where: { userId: user.id, archived: false }, orderBy: { code: "asc" } }),
  ]);
  return <QuizzesClient quizzes={serialize<QuizDTO[]>(quizzes)} courses={serialize<CourseDTO[]>(courses)} />;
}
