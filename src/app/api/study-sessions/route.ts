import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  label: z.string().nullable().optional(),
  mode: z.string().default("25"),
  minutes: z.number().int().min(1).max(600),
  courseId: z.string().nullable().optional(),
  assignmentId: z.string().nullable().optional(),
  completed: z.boolean().default(true),
});

export const GET = withAuth(async (_req, user) => {
  const since = new Date();
  since.setDate(since.getDate() - 28);
  const sessions = await db.studySession.findMany({
    where: { userId: user.id, startedAt: { gte: since } },
    include: { course: { select: { id: true, code: true, color: true } } },
    orderBy: { startedAt: "desc" },
  });
  return ok({ sessions });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const started = new Date(Date.now() - data.minutes * 60000);
  const session = await db.studySession.create({
    data: { ...data, userId: user.id, startedAt: started, endedAt: new Date() },
  });
  return ok({ session });
});
