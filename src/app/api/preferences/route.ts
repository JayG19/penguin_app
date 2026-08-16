import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const schema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  widgetLayout: z.string().optional(),
  syncMode: z.enum(["manual", "launch", "interval"]).optional(),
  syncIntervalMins: z.number().int().min(5).max(1440).optional(),
  notificationPrefs: z.string().optional(),
  targetGrades: z.string().optional(),
  lastSeenFeedAt: z.string().datetime().optional(),
});

export const GET = withAuth(async (_req, user) => {
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  return ok({ preference: pref });
});

export const PATCH = withAuth(async (req, user) => {
  const data = schema.parse(await req.json());
  const pref = await db.userPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...data,
      lastSeenFeedAt: data.lastSeenFeedAt ? new Date(data.lastSeenFeedAt) : undefined,
    },
    update: { ...data, lastSeenFeedAt: data.lastSeenFeedAt ? new Date(data.lastSeenFeedAt) : undefined },
  });
  return ok({ preference: pref });
});
