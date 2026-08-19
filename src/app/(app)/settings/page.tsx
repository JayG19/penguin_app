import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_NUDGE_PREFS, parseNudgePrefs } from "@/lib/nudges/prefs";
import { brightspaceMode } from "@/lib/brightspace/config";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  const pref = await db.userPreference.findUnique({ where: { userId: user.id } });
  void DEFAULT_NUDGE_PREFS;

  return (
    <SettingsClient
      userName={user.name}
      email={user.email}
      appearance={{
        theme: pref?.theme ?? "system",
        accent: pref?.accent ?? "indigo",
        background: pref?.background ?? "plain",
        backgroundUrl: pref?.backgroundUrl ?? null,
        priorityScheme: pref?.priorityScheme ?? "classic",
        density: pref?.density ?? "comfortable",
      }}
      syncMode={pref?.syncMode ?? "manual"}
      notificationPrefs={pref?.notificationPrefs ?? null}
      nudgePrefs={parseNudgePrefs(pref?.nudgePrefs)}
      brightspaceMode={brightspaceMode()}
    />
  );
}
