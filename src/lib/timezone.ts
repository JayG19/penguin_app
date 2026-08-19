/** A small curated list — enough to cover most students without a huge picker. */
export const COMMON_TIMEZONES = [
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Vancouver",
  "America/Denver", "America/Edmonton", "America/Chicago", "America/Winnipeg",
  "America/New_York", "America/Toronto", "America/Halifax", "America/St_Johns",
  "America/Sao_Paulo", "UTC", "Europe/London", "Europe/Dublin", "Europe/Paris",
  "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Athens", "Europe/Moscow",
  "Africa/Cairo", "Africa/Johannesburg", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore",
  "Asia/Tokyo", "Asia/Seoul", "Australia/Perth", "Australia/Sydney", "Pacific/Auckland",
] as const;

/** Best-effort browser-detected IANA timezone, e.g. "America/Toronto". */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** UTC offset in minutes for a timezone at a given instant (positive east of Greenwich). */
function utcOffsetMinutes(tz: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date).reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtcMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtcMs - date.getTime()) / 60000);
}

/**
 * A human label with a `UTC±HH:MM` offset computed by hand (rather than
 * Intl's `timeZoneName: "shortOffset"`, whose formatting is inconsistent
 * between server and browser ICU builds and caused an SSR hydration
 * mismatch when this ran during render).
 */
export function timezoneLabel(tz: string, date = new Date()): string {
  try {
    const mins = utcOffsetMinutes(tz, date);
    const sign = mins < 0 ? "-" : "+";
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const offset = m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, "0")}`;
    return `${tz.replace(/_/g, " ")} (${offset})`;
  } catch {
    return tz;
  }
}

/** The hour (0–23) a given instant falls on, in a specific IANA timezone — a
 * zero-dependency alternative to date-fns-tz for the one thing we need. */
export function getHourInTimezone(date: Date, tz: string | null | undefined): number {
  if (!tz) return date.getHours();
  try {
    const hour = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(date);
    // "24" is returned for midnight by some ICU implementations.
    return parseInt(hour, 10) % 24;
  } catch {
    return date.getHours();
  }
}
