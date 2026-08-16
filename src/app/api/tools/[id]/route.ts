import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  pinned: z.boolean().optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.tool.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  const body = patchSchema.parse(await req.json());
  const tool = await db.tool.update({ where: { id }, data: body });
  return ok({ tool });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.tool.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  await db.tool.delete({ where: { id } });
  return ok();
});
