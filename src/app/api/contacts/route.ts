import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  courseId: z.string(),
  name: z.string().min(1),
  role: z.enum(["professor", "ta"]).default("professor"),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  office: z.string().nullable().optional(),
  officeHours: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export const GET = withAuth(async (req, user) => {
  const courseId = new URL(req.url).searchParams.get("courseId") ?? undefined;
  const contacts = await db.contact.findMany({
    where: { course: { userId: user.id }, ...(courseId ? { courseId } : {}) },
    include: { course: { select: { id: true, code: true, name: true, color: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return ok({ contacts });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const course = await db.course.findFirst({ where: { id: data.courseId, userId: user.id } });
  if (!course) return ok({ error: "Course not found" });
  const contact = await db.contact.create({ data: { ...data, source: "manual" }, include: { course: true } });
  return ok({ contact });
});
