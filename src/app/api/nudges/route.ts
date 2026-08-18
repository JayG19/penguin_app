import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  remindAt: z.string().datetime(),
  category: z.string().default("custom"),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
});

export const GET = withAuth(async (req, user) => {
  const params = new URL(req.url).searchParams;
  const entityType = params.get("entityType") ?? undefined;
  const entityId = params.get("entityId") ?? undefined;
  const now = new Date();

  const all = await db.nudge.findMany({
    where: {
      userId: user.id,
      dismissed: false,
      ...(entityType && entityId ? { entityType, entityId } : {}),
    },
    orderBy: { remindAt: "asc" },
    take: 100,
  });

  // "Due" = past its remind time and not snoozed past now.
  const due = all.filter((n) => n.remindAt <= now && (!n.snoozedUntil || n.snoozedUntil <= now));
  const scheduled = all.filter((n) => !due.includes(n));
  return ok({ due, scheduled });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const nudge = await db.nudge.create({
    data: {
      userId: user.id,
      kind: "manual",
      title: data.title,
      body: data.body ?? null,
      remindAt: new Date(data.remindAt),
      category: data.category,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
    },
  });
  return ok({ nudge });
});
