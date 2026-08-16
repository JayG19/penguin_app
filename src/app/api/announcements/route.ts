import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  courseId: z.string(),
  title: z.string().min(1),
  body: z.string().default(""),
  author: z.string().nullable().optional(),
});

export const GET = withAuth(async (req, user) => {
  const courseId = new URL(req.url).searchParams.get("courseId") ?? undefined;
  const announcements = await db.announcement.findMany({
    where: { course: { userId: user.id }, ...(courseId ? { courseId } : {}) },
    include: { course: { select: { id: true, code: true, color: true } } },
    orderBy: { postedAt: "desc" },
  });
  return ok({ announcements });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const course = await db.course.findFirst({ where: { id: data.courseId, userId: user.id } });
  if (!course) return ok({ error: "Course not found" });
  const announcement = await db.announcement.create({
    data: { ...data, source: "manual", read: true },
    include: { course: true },
  });
  return ok({ announcement });
});

// Mark all read (optionally scoped to a course)
const markSchema = z.object({ courseId: z.string().optional() });

export const PATCH = withAuth(async (req, user) => {
  const { courseId } = markSchema.parse(await req.json());
  await db.announcement.updateMany({
    where: { course: { userId: user.id }, ...(courseId ? { courseId } : {}) },
    data: { read: true },
  });
  return ok();
});
