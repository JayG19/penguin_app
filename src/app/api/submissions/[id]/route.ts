import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok, notFound, type IdCtx } from "@/lib/api-helpers";
import { restoreFields, trackOverrides } from "@/lib/sync/overrides";

const patchSchema = z.object({
  status: z.enum(["not_submitted", "submitted", "late", "graded", "returned"]).optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  grade: z.string().nullable().optional(),
  feedback: z.string().nullable().optional(),
  restore: z.array(z.string()).optional(),
});

// id = assignment id (submissions are 1:1 with assignments)
export const PATCH = withAuth(async (req, user, ctx: IdCtx) => {
  const { id } = await ctx.params;
  const assignment = await db.assignment.findFirst({ where: { id, course: { userId: user.id } }, include: { submission: true } });
  if (!assignment) return notFound();
  const { restore, ...body } = patchSchema.parse(await req.json());

  if (restore?.length && assignment.submission) {
    const { updates: restored, overriddenFields } = restoreFields(assignment.submission, restore);
    const submission = await db.submission.update({
      where: { id: assignment.submission.id },
      data: { ...restored, overriddenFields },
    });
    return ok({ submission });
  }

  const updates: Record<string, unknown> = { ...body };
  if (body.submittedAt !== undefined) updates.submittedAt = body.submittedAt ? new Date(body.submittedAt) : null;
  if (body.status === "submitted" && body.submittedAt === undefined && !assignment.submission?.submittedAt) {
    updates.submittedAt = new Date();
  }

  let submission;
  if (assignment.submission) {
    const overriddenFields = trackOverrides("submission", assignment.submission, updates);
    submission = await db.submission.update({ where: { id: assignment.submission.id }, data: { ...updates, overriddenFields } });
  } else {
    submission = await db.submission.create({ data: { assignmentId: id, ...updates, source: "manual" } });
  }
  return ok({ submission });
});
