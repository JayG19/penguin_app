import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";
import { trackOverrides } from "@/lib/sync/overrides";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["professor", "ta"]).optional(),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  office: z.string().nullable().optional(),
  officeHours: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.contact.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  const body = patchSchema.parse(await req.json());
  const overriddenFields = trackOverrides("contact", existing, body);
  const contact = await db.contact.update({ where: { id }, data: { ...body, overriddenFields }, include: { course: true } });
  return ok({ contact });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.contact.findFirst({ where: { id, course: { userId: user.id } } });
  if (!existing) return notFound();
  await db.contact.delete({ where: { id } });
  return ok();
});
