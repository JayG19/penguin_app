/** Nudge preferences, stored as JSON on UserPreference.nudgePrefs. */
export interface NudgePrefs {
  enabled: boolean;
  /** Hours before a deadline at which to raise a nudge (descending). */
  leadHours: number[];
  categories: {
    deadline: boolean;
    exam: boolean;
    announcement: boolean;
    grade: boolean;
  };
  /** Minimum weight (% of grade) an item needs before it earns a nudge. */
  minWeight: number;
  /** Quiet hours, 0–23; nudges due inside the window wait until it ends. */
  quietStart: number | null;
  quietEnd: number | null;
}

export const DEFAULT_NUDGE_PREFS: NudgePrefs = {
  enabled: true,
  leadHours: [72, 24, 3],
  categories: { deadline: true, exam: true, announcement: true, grade: true },
  minWeight: 0,
  quietStart: 23,
  quietEnd: 7,
};

export function parseNudgePrefs(raw: string | null | undefined): NudgePrefs {
  if (!raw) return DEFAULT_NUDGE_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<NudgePrefs>;
    return {
      ...DEFAULT_NUDGE_PREFS,
      ...parsed,
      categories: { ...DEFAULT_NUDGE_PREFS.categories, ...(parsed.categories ?? {}) },
      leadHours: Array.isArray(parsed.leadHours) && parsed.leadHours.length ? parsed.leadHours : DEFAULT_NUDGE_PREFS.leadHours,
    };
  } catch {
    return DEFAULT_NUDGE_PREFS;
  }
}

/**
 * Pushes a reminder out of the user's quiet window (e.g. 23:00–07:00 becomes
 * 07:00 the same night). Windows that wrap past midnight are handled.
 */
export function applyQuietHours(when: Date, prefs: NudgePrefs): Date {
  const { quietStart, quietEnd } = prefs;
  if (quietStart == null || quietEnd == null || quietStart === quietEnd) return when;
  const hour = when.getHours();
  const inQuiet = quietStart < quietEnd ? hour >= quietStart && hour < quietEnd : hour >= quietStart || hour < quietEnd;
  if (!inQuiet) return when;
  const out = new Date(when);
  if (quietStart < quietEnd || hour < quietEnd) {
    out.setHours(quietEnd, 0, 0, 0);
  } else {
    out.setDate(out.getDate() + 1);
    out.setHours(quietEnd, 0, 0, 0);
  }
  return out;
}
