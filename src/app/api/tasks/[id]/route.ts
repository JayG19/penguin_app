import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  kind: z.enum(["task", "reading", "study", "reminder", "project", "presentation"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  completed: z.boolean().optional(),
  priorityOverride: z.enum(["high", "medium", "low"]).nullable().optional(),
  notes: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  const body = patchSchema.parse(await req.json());
  const task = await db.task.update({
    where: { id },
    data: { ...body, dueAt: body.dueAt !== undefined ? (body.dueAt ? new Date(body.dueAt) : null) : undefined },
    include: { course: true },
  });
  return ok({ task });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  await db.task.delete({ where: { id } });
  return ok();
});
