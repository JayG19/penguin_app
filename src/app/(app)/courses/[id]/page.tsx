import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { CourseClient, type CourseDetailData } from "./CourseClient";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const course = await db.course.findFirst({
    where: { id, userId: user.id },
    include: {
      contacts: { orderBy: [{ role: "asc" }, { name: "asc" }] },
      modules: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
      assignments: { include: { submission: true, course: { select: { id: true, code: true, name: true, color: true } } }, orderBy: { dueAt: "asc" } },
      quizzes: { include: { course: { select: { id: true, code: true, name: true, color: true } } }, orderBy: { startAt: "asc" } },
      announcements: { include: { course: { select: { id: true, code: true, name: true, color: true } } }, orderBy: { postedAt: "desc" } },
      gradeItems: true,
      notes: { orderBy: { updatedAt: "desc" } },
      resources: true,
    },
  });
  if (!course) notFound();

  return <CourseClient data={serialize<CourseDetailData>(course)} />;
}
