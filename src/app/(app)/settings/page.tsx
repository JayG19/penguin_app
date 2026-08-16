import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  return (
    <SettingsClient
      userName={user.name}
      email={user.email}
      theme={pref?.theme ?? "system"}
      syncMode={pref?.syncMode ?? "manual"}
      notificationPrefs={pref?.notificationPrefs ?? null}
      brightspaceMode={process.env.BRIGHTSPACE_MODE === "live" ? "live" : "mock"}
    />
  );
}
