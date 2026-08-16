import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";
import { restoreFields, trackOverrides } from "@/lib/sync/overrides";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  kind: z.enum(["quiz", "midterm", "final", "exam"]).optional(),
  startAt: z.string().datetime().nullable().optional(),
  durationMins: z.number().int().min(1).nullable().optional(),
  location: z.string().nullable().optional(),
  topics: z.string().nullable().optional(),
  weight: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(["upcoming", "completed", "missed"]).optional(),
  priorityOverride: z.enum(["high", "medium", "low"]).nullable().optional(),
  restore: z.array(z.string()).optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.quiz.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();

  const { restore, ...body } = patchSchema.parse(await req.json());
  if (restore?.length) {
    const { updates, overriddenFields } = restoreFields(existing, restore);
    const quiz = await db.quiz.update({ where: { id }, data: { ...updates, overriddenFields }, include: { course: true } });
    return ok({ quiz });
  }

  const updates: Record<string, unknown> = { ...body };
  if (body.startAt !== undefined) updates.startAt = body.startAt ? new Date(body.startAt) : null;
  const overriddenFields = trackOverrides("quiz", existing, updates);
  const quiz = await db.quiz.update({ where: { id }, data: { ...updates, overriddenFields }, include: { course: true } });
  return ok({ quiz });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.quiz.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  await db.quiz.delete({ where: { id } });
  return ok();
});
