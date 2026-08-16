import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["class", "personal", "reminder", "event"]).default("personal"),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
  allDay: z.boolean().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
});

export const GET = withAuth(async (req, user) => {
  const params = new URL(req.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const events = await db.calendarEvent.findMany({
    where: {
      userId: user.id,
      ...(from && to ? { startAt: { gte: new Date(from), lte: new Date(to) } } : {}),
    },
    include: { course: { select: { id: true, code: true, color: true } } },
    orderBy: { startAt: "asc" },
  });
  return ok({ events });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const event = await db.calendarEvent.create({
    data: {
      ...data,
      userId: user.id,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      source: "manual",
    },
    include: { course: true },
  });
  return ok({ event });
});
