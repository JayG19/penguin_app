import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  courseId: z.string(),
  title: z.string().min(1),
  kind: z.enum(["quiz", "midterm", "final", "exam"]).default("quiz"),
  startAt: z.string().datetime().nullable().optional(),
  durationMins: z.number().int().min(1).nullable().optional(),
  location: z.string().nullable().optional(),
  topics: z.string().nullable().optional(),
  weight: z.number().min(0).max(100).nullable().optional(),
});

export const GET = withAuth(async (req, user) => {
  const courseId = new URL(req.url).searchParams.get("courseId") ?? undefined;
  const quizzes = await db.quiz.findMany({
    where: { course: { userId: user.id }, ...(courseId ? { courseId } : {}) },
    include: { course: { select: { id: true, code: true, name: true, color: true } } },
    orderBy: [{ startAt: "asc" }],
  });
  return ok({ quizzes });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const course = await db.course.findFirst({ where: { id: data.courseId, userId: user.id } });
  if (!course) return ok({ error: "Course not found" });
  const quiz = await db.quiz.create({
    data: { ...data, startAt: data.startAt ? new Date(data.startAt) : null, source: "manual" },
    include: { course: true },
  });
  return ok({ quiz });
});
