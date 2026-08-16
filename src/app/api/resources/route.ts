import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  courseId: z.string().nullable().optional(),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().nullable().optional(),
});

export const GET = withAuth(async (req, user) => {
  const courseId = new URL(req.url).searchParams.get("courseId") ?? undefined;
  const resources = await db.resource.findMany({
    where: courseId ? { courseId, course: { userId: user.id } } : { OR: [{ course: { userId: user.id } }, { courseId: null }] },
  });
  return ok({ resources });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  if (data.courseId) {
    const course = await db.course.findFirst({ where: { id: data.courseId, userId: user.id } });
    if (!course) return ok({ error: "Course not found" });
  }
  const resource = await db.resource.create({ data: { ...data, source: "manual" } });
  return ok({ resource });
});
