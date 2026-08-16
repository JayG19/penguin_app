import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";

const patchSchema = z.object({ read: z.boolean() });

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.announcement.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  const { read } = patchSchema.parse(await req.json());
  const announcement = await db.announcement.update({ where: { id }, data: { read }, include: { course: true } });
  return ok({ announcement });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.announcement.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  await db.announcement.delete({ where: { id } });
  return ok();
});
