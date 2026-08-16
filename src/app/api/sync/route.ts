import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";
import { runSync } from "@/lib/sync/engine";

export const GET = withAuth(async (_req, user) => {
  const logs = await db.syncLog.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  return ok({ logs });
});

export const POST = withAuth(async (_req, user) => {
  const running = await db.syncLog.findFirst({ where: { userId: user.id, status: "running" } });
  if (running && Date.now() - running.startedAt.getTime() < 60_000) {
    return ok({ error: "A sync is already running" });
  }
  const result = await runSync(user.id);
  return ok(result);
});
