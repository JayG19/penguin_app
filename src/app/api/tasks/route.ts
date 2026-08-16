import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(["task", "reading", "study", "reminder", "project", "presentation"]).default("task"),
  dueAt: z.string().datetime().nullable().optional(),
  courseId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  weight: z.number().min(0).max(100).nullable().optional(),
});

export const GET = withAuth(async (_req, user) => {
  const tasks = await db.task.findMany({
    where: { userId: user.id },
    include: { course: { select: { id: true, code: true, color: true } } },
    orderBy: [{ completed: "asc" }, { dueAt: "asc" }],
  });
  return ok({ tasks });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  if (data.courseId) {
    const course = await db.course.findFirst({ where: { id: data.courseId, userId: user.id } });
    if (!course) data.courseId = null;
  }
  const task = await db.task.create({
    data: { ...data, userId: user.id, dueAt: data.dueAt ? new Date(data.dueAt) : null },
    include: { course: true },
  });
  return ok({ task });
});
