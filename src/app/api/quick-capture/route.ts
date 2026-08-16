import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";
import { parseQuickCapture } from "@/lib/quickcapture";

const schema = z.object({ text: z.string().min(1) });

/** Parse-only endpoint: the client shows the interpretation for confirmation,
 * then saves through POST /api/tasks. */
export const POST = withAuth(async (req, user) => {
  const { text } = schema.parse(await req.json());
  const parsed = parseQuickCapture(text);
  let course: { id: string; code: string } | null = null;
  if (parsed.courseHint) {
    course = await db.course.findFirst({
      where: { userId: user.id, code: { contains: parsed.courseHint } },
      select: { id: true, code: true },
    });
  } else {
    // Try matching a course name word ("business analytics assignment ...")
    const courses = await db.course.findMany({ where: { userId: user.id }, select: { id: true, code: true, name: true } });
    const lower = parsed.title.toLowerCase();
    course = courses.find((c) => lower.includes(c.name.toLowerCase()) || lower.includes(c.code.toLowerCase())) ?? null;
  }
  return ok({
    title: parsed.title,
    dueAt: parsed.dueAt?.toISOString() ?? null,
    course,
  });
});
