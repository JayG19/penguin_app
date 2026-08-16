import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { SyncLogDTO } from "@/components/types";
import { SyncClient } from "./SyncClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brightspace" };

export default async function SyncPage() {
  const user = (await getSessionUser())!;
  const logs = await db.syncLog.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  const mode = process.env.BRIGHTSPACE_MODE === "live" ? "live" : "mock";
  const connected = mode === "live" ? !!(await db.brightspaceConnection.findUnique({ where: { userId: user.id } })) : true;
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });

  return (
    <SyncClient
      logs={serialize<SyncLogDTO[]>(logs)}
      mode={mode}
      connected={connected}
      syncMode={pref?.syncMode ?? "manual"}
      syncIntervalMins={pref?.syncIntervalMins ?? 30}
    />
  );
}
