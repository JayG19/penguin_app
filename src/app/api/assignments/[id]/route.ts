import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";
import { restoreFields, trackOverrides } from "@/lib/sync/overrides";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  weight: z.number().min(0).max(100).nullable().optional(),
  estimatedHours: z.number().min(0).nullable().optional(),
  difficulty: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "submitted", "overdue"]).optional(),
  completionPct: z.number().int().min(0).max(100).optional(),
  priorityOverride: z.enum(["high", "medium", "low"]).nullable().optional(),
  notes: z.string().nullable().optional(),
  restore: z.array(z.string()).optional(), // field names to restore to Brightspace values
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.assignment.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();

  const { restore, ...body } = patchSchema.parse(await req.json());

  if (restore?.length) {
    const { updates, overriddenFields } = restoreFields(existing, restore);
    const assignment = await db.assignment.update({
      where: { id },
      data: { ...updates, overriddenFields },
      include: { course: true, submission: true },
    });
    return ok({ assignment });
  }

  const updates: Record<string, unknown> = { ...body };
  if (body.dueAt !== undefined) updates.dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (body.status === "completed" || body.status === "submitted") updates.completionPct = 100;

  const overriddenFields = trackOverrides("assignment", existing, updates);
  const assignment = await db.assignment.update({
    where: { id },
    data: { ...updates, overriddenFields },
    include: { course: true, submission: true },
  });
  return ok({ assignment });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.assignment.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  await db.assignment.delete({ where: { id } });
  return ok();
});
