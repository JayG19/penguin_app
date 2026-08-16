import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(["class", "personal", "reminder", "event"]).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  allDay: z.boolean().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.calendarEvent.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  const body = patchSchema.parse(await req.json());
  const event = await db.calendarEvent.update({
    where: { id },
    data: {
      ...body,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt !== undefined ? (body.endAt ? new Date(body.endAt) : null) : undefined,
    },
    include: { course: true },
  });
  return ok({ event });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.calendarEvent.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  await db.calendarEvent.delete({ where: { id } });
  return ok();
});
