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
  recurrenceUnit: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  recurrenceInterval: z.number().int().min(1).max(99).nullable().optional(),
  recurrenceUntil: z.string().datetime().nullable().optional(),
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

/** Stored as "<unit>:<interval>:<untilDate?>", e.g. "weekly:1:" or "weekly:3:2026-12-15" — a
 * uniform interval-based encoding, so "every N days/weeks/months" (the presets *and* any custom
 * interval) all parse the same way. */
function encodeRecurrence(unit: string | null | undefined, interval: number | null | undefined, until: string | null | undefined) {
  if (!unit || !interval) return null;
  return `${unit}:${interval}:${until ? until.slice(0, 10) : ""}`;
}

export const POST = withAuth(async (req, user) => {
  const { recurrenceUnit, recurrenceInterval, recurrenceUntil, ...data } = createSchema.parse(await req.json());
  const event = await db.calendarEvent.create({
    data: {
      ...data,
      userId: user.id,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      recurrence: encodeRecurrence(recurrenceUnit, recurrenceInterval, recurrenceUntil),
      source: "manual",
    },
    include: { course: true },
  });
  return ok({ event });
});
