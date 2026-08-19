export type BrightspaceMode = "off" | "mock" | "live";

/**
 * "off" is the default so a fresh deployment runs in manual mode: no demo data
 * can leak into a real account, and the sync UI explains what's missing rather
 * than pretending to work.
 */
export function brightspaceMode(): BrightspaceMode {
  const raw = process.env.BRIGHTSPACE_MODE?.toLowerCase();
  if (raw === "live") return "live";
  if (raw === "mock") return "mock";
  return "off";
}

export function brightspaceEnabled(): boolean {
  return brightspaceMode() !== "off";
}

/** Which BRIGHTSPACE_* variables are still missing for live mode. */
export function missingLiveConfig(): string[] {
  return ["BRIGHTSPACE_BASE_URL", "BRIGHTSPACE_CLIENT_ID", "BRIGHTSPACE_CLIENT_SECRET", "BRIGHTSPACE_REDIRECT_URI"]
    .filter((k) => !process.env[k]);
}
