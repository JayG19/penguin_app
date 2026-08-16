import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";
import { restoreFields, trackOverrides } from "@/lib/sync/overrides";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["assignment", "quiz", "midterm", "final", "participation", "project", "other"]).optional(),
  weight: z.number().min(0).max(100).optional(),
  score: z.number().min(0).nullable().optional(),
  maxScore: z.number().min(0.01).optional(),
  restore: z.array(z.string()).optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.gradeItem.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  const { restore, ...body } = patchSchema.parse(await req.json());
  if (restore?.length) {
    const { updates, overriddenFields } = restoreFields(existing, restore);
    const grade = await db.gradeItem.update({ where: { id }, data: { ...updates, overriddenFields }, include: { course: true } });
    return ok({ grade });
  }
  const updates: Record<string, unknown> = { ...body };
  if (body.score !== undefined && body.score !== null && existing.score == null) updates.gradedAt = new Date();
  const overriddenFields = trackOverrides("grade", existing, updates);
  const grade = await db.gradeItem.update({ where: { id }, data: { ...updates, overriddenFields }, include: { course: true } });
  return ok({ grade });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.gradeItem.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  await db.gradeItem.delete({ where: { id } });
  return ok();
});
