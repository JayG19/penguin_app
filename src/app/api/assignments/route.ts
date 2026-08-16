import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  courseId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  weight: z.number().min(0).max(100).nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  difficulty: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "submitted", "overdue"]).optional(),
});

export const GET = withAuth(async (req, user) => {
  const courseId = new URL(req.url).searchParams.get("courseId") ?? undefined;
  const assignments = await db.assignment.findMany({
    where: { course: { userId: user.id }, ...(courseId ? { courseId } : {}) },
    include: { course: { select: { id: true, code: true, name: true, color: true } }, submission: true },
    orderBy: [{ dueAt: "asc" }],
  });
  return ok({ assignments });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const course = await db.course.findFirst({ where: { id: data.courseId, userId: user.id } });
  if (!course) return ok({ error: "Course not found" });
  const assignment = await db.assignment.create({
    data: {
      ...data,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      source: "manual",
      submission: { create: { source: "manual" } },
    },
    include: { course: true, submission: true },
  });
  return ok({ assignment });
});
