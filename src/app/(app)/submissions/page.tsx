import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AssignmentDTO, CourseDTO } from "@/components/types";
import { SubmissionsClient } from "./SubmissionsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submissions" };

export default async function SubmissionsPage() {
  const user = (await getSessionUser())!;
  const [assignments, courses] = await Promise.all([
    db.assignment.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } }, submission: true },
      orderBy: { dueAt: "desc" },
    }),
    db.course.findMany({ where: { userId: user.id, archived: false }, orderBy: { code: "asc" } }),
  ]);
  return <SubmissionsClient assignments={serialize<AssignmentDTO[]>(assignments)} courses={serialize<CourseDTO[]>(courses)} />;
}
