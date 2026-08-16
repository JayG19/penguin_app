import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";
import { trackOverrides } from "@/lib/sync/overrides";

const patchSchema = z.object({
  code: z.string().min(2).optional(),
  name: z.string().min(1).optional(),
  term: z.string().optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  officeHours: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.course.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  const body = patchSchema.parse(await req.json());
  const overriddenFields = trackOverrides("course", existing, body);
  const course = await db.course.update({ where: { id }, data: { ...body, overriddenFields } });
  return ok({ course });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.course.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  await db.course.delete({ where: { id } });
  return ok();
});
