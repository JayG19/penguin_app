import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

export const GET = withAuth(async (_req, user) => {
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const unread = await db.notification.count({ where: { userId: user.id, read: false } });
  return ok({ notifications, unread });
});

const schema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });

export const PATCH = withAuth(async (req, user) => {
  const { ids, all } = schema.parse(await req.json());
  if (all) {
    await db.notification.updateMany({ where: { userId: user.id }, data: { read: true } });
  } else if (ids?.length) {
    await db.notification.updateMany({ where: { userId: user.id, id: { in: ids } }, data: { read: true } });
  }
  return ok();
});
