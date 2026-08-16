import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  courseId: z.string(),
  name: z.string().min(1),
  category: z.enum(["assignment", "quiz", "midterm", "final", "participation", "project", "other"]).default("assignment"),
  weight: z.number().min(0).max(100),
  score: z.number().min(0).nullable().optional(),
  maxScore: z.number().min(0.01).default(100),
});

export const GET = withAuth(async (req, user) => {
  const courseId = new URL(req.url).searchParams.get("courseId") ?? undefined;
  const grades = await db.gradeItem.findMany({
    where: { course: { userId: user.id }, ...(courseId ? { courseId } : {}) },
    include: { course: { select: { id: true, code: true, name: true, color: true } } },
    orderBy: { weight: "desc" },
  });
  return ok({ grades });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const course = await db.course.findFirst({ where: { id: data.courseId, userId: user.id } });
  if (!course) return ok({ error: "Course not found" });
  const grade = await db.gradeItem.create({
    data: { ...data, gradedAt: data.score != null ? new Date() : null, source: "manual" },
    include: { course: true },
  });
  return ok({ grade });
});
