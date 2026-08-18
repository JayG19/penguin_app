import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";

const patchSchema = z.object({
  dismissed: z.boolean().optional(),
  acknowledged: z.boolean().optional(),
  /** Snooze by N minutes from now. */
  snoozeMinutes: z.number().int().min(1).max(60 * 24 * 14).optional(),
  remindAt: z.string().datetime().optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.nudge.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  const body = patchSchema.parse(await req.json());

  const data: Record<string, unknown> = {};
  if (body.dismissed !== undefined) data.dismissed = body.dismissed;
  if (body.acknowledged !== undefined) data.acknowledged = body.acknowledged;
  if (body.remindAt) data.remindAt = new Date(body.remindAt);
  if (body.snoozeMinutes) data.snoozedUntil = new Date(Date.now() + body.snoozeMinutes * 60_000);

  const nudge = await db.nudge.update({ where: { id }, data });
  return ok({ nudge });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.nudge.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  await db.nudge.delete({ where: { id } });
  return ok();
});
