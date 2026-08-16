import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isToday,
  isTomorrow,
  isYesterday,
} from "date-fns";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function fmtDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = new Date(d);
  return format(date, withTime ? "MMM d, h:mm a" : "MMM d");
}

export function fmtDateLong(d: Date | string) {
  return format(new Date(d), "EEEE, MMMM d, yyyy");
}

export function relativeDue(d: Date | string | null | undefined): string {
  if (!d) return "No due date";
  const date = new Date(d);
  const now = new Date();
  const days = differenceInCalendarDays(date, now);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (isToday(date)) return `Due today, ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Due tomorrow, ${format(date, "h:mm a")}`;
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${format(date, "MMM d")}`;
}

export function timeAgo(d: Date | string): string {
  const date = new Date(d);
  const now = new Date();
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h ago`;
  if (isYesterday(date)) return "yesterday";
  const days = differenceInCalendarDays(now, date);
  if (days <= 14) return `${days}d ago`;
  return format(date, "MMM d");
}

/** "3 days 7 hours remaining" style countdown; null once passed. */
export function countdown(d: Date | string): string | null {
  const target = new Date(d).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rem = mins % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${rem}m remaining`;
  return `${rem}m remaining`;
}

export function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export const COURSE_COLORS: Record<string, { dot: string; soft: string; text: string; bar: string }> = {
  indigo: { dot: "bg-indigo-500", soft: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", bar: "bg-indigo-500" },
  emerald: { dot: "bg-emerald-500", soft: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  amber: { dot: "bg-amber-500", soft: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  rose: { dot: "bg-rose-500", soft: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
  sky: { dot: "bg-sky-500", soft: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", bar: "bg-sky-500" },
  violet: { dot: "bg-violet-500", soft: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", bar: "bg-violet-500" },
};

export function courseColor(color: string | null | undefined) {
  return COURSE_COLORS[color ?? "indigo"] ?? COURSE_COLORS.indigo;
}
