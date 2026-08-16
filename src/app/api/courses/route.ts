import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  term: z.string().default("Fall 2026"),
  description: z.string().nullable().optional(),
  color: z.string().default("indigo"),
  officeHours: z.string().nullable().optional(),
});

export const GET = withAuth(async (_req, user) => {
  const courses = await db.course.findMany({
    where: { userId: user.id, archived: false },
    orderBy: { code: "asc" },
  });
  return ok({ courses });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const course = await db.course.create({
    data: { ...data, userId: user.id, source: "manual", enrollments: { create: { userId: user.id } } },
  });
  return ok({ course });
});
