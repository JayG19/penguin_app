import { differenceInCalendarDays } from "date-fns";

export type Priority = "high" | "medium" | "low";

export interface Prioritizable {
  dueAt: Date | string | null;
  weight?: number | null;
  completed?: boolean;
  completionPct?: number;
  estimatedHours?: number | null;
  priorityOverride?: string | null;
}

/**
 * Priority scoring: weight (how much of the grade), urgency (days remaining),
 * remaining work and overdue status. Manual overrides always win.
 */
export function priorityScore(item: Prioritizable, now = new Date()): number {
  if (item.completed || (item.completionPct ?? 0) >= 100) return -1;
  let score = 0;
  const weight = item.weight ?? 5;
  score += Math.min(weight, 40); // up to 40 pts from weight

  if (item.dueAt) {
    const days = differenceInCalendarDays(new Date(item.dueAt), now);
    if (days < 0) score += 50; // overdue
    else if (days === 0) score += 40;
    else if (days <= 2) score += 32;
    else if (days <= 4) score += 24;
    else if (days <= 7) score += 15;
    else if (days <= 14) score += 6;
  }

  const remaining = 1 - (item.completionPct ?? 0) / 100;
  score += remaining * ((item.estimatedHours ?? 2) > 6 ? 12 : 6);
  return score;
}

export function computePriority(item: Prioritizable, now = new Date()): Priority {
  if (item.priorityOverride === "high" || item.priorityOverride === "medium" || item.priorityOverride === "low") {
    return item.priorityOverride;
  }
  const score = priorityScore(item, now);
  if (score >= 45) return "high";
  if (score >= 25) return "medium";
  return "low";
}
