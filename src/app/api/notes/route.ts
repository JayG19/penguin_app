import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(""),
  topic: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
  assignmentId: z.string().nullable().optional(),
  quizId: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
});

export const GET = withAuth(async (req, user) => {
  const params = new URL(req.url).searchParams;
  const courseId = params.get("courseId") ?? undefined;
  const q = params.get("q") ?? undefined;
  const notes = await db.note.findMany({
    where: {
      userId: user.id,
      ...(courseId ? { courseId } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { body: { contains: q } }] } : {}),
    },
    include: {
      course: { select: { id: true, code: true, color: true } },
      assignment: { select: { id: true, title: true } },
      quiz: { select: { id: true, title: true } },
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return ok({ notes });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const note = await db.note.create({
    data: { ...data, userId: user.id },
    include: { course: true, assignment: true, quiz: true },
  });
  return ok({ note });
});
