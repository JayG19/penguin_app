import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  topic: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
  assignmentId: z.string().nullable().optional(),
  quizId: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
});

export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.note.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  const body = patchSchema.parse(await req.json());
  const note = await db.note.update({
    where: { id },
    data: body,
    include: { course: true, assignment: true, quiz: true },
  });
  return ok({ note });
});

export const DELETE = withAuth(async (_req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const existing = await db.note.findFirst({ where: { id, userId: user.id } });
  if (!existing) return notFound();
  await db.note.delete({ where: { id } });
  return ok();
});
