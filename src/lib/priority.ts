import { differenceInCalendarDays } from "date-fns";

/**
 * `review` = work is finished but not yet submitted (final check / QC).
 * `done`   = submitted or completed; it no longer competes for attention.
 */
export type Priority = "high" | "medium" | "low" | "review" | "done";

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Final check",
  done: "Done",
};

/** Statuses that mean the work has left the student's queue. */
export const DONE_STATUSES = ["completed", "submitted"];

export interface Prioritizable {
  dueAt: Date | string | null;
  weight?: number | null;
  completed?: boolean;
  completionPct?: number;
  estimatedHours?: number | null;
  priorityOverride?: string | null;
  status?: string | null;
}

export function priorityScore(item: Prioritizable, now = new Date()): number {
  if (item.completed || isDone(item)) return -1;

  // Weight scaled by urgency, rather than urgency added on top of it: a heavy
  // assessment gets more urgent as it approaches, while a trivial errand due
  // today stays trivial. The floor keeps genuinely imminent work visible even
  // when it carries no grade weight at all.
  const weight = item.weight ?? 2;
  const days = item.dueAt ? differenceInCalendarDays(new Date(item.dueAt), now) : null;

  let multiplier = 1;
  let floor = 0;
  if (days != null) {
    if (days < 0) { multiplier = 3; floor = 20; }
    else if (days === 0) { multiplier = 2.5; floor = 18; }
    else if (days <= 2) { multiplier = 2; floor = 12; }
    else if (days <= 4) { multiplier = 1.6; floor = 8; }
    else if (days <= 7) { multiplier = 1.3; floor = 4; }
    else if (days <= 14) { multiplier = 1.1; }
    else if (days <= 30) { multiplier = 0.6; }
    // Beyond a month even a heavy final shouldn't crowd out this week's work.
    else { multiplier = 0.4; }
  }

  let score = weight * multiplier + floor;

  // Work still outstanding counts for a little more than work nearly done.
  const remaining = 1 - (item.completionPct ?? 0) / 100;
  score += remaining * ((item.estimatedHours ?? 2) > 6 ? 5 : 2);

  // Finished-but-unsubmitted work keeps a floor so it never sinks to the
  // bottom of the queue — it still needs one action before it's really done.
  if (isReview(item)) score = Math.max(score, 20);
  return score;
}

function isDone(item: Prioritizable): boolean {
  return !!item.status && DONE_STATUSES.includes(item.status);
}

/** 100% complete (or explicitly flagged) but not yet submitted. */
function isReview(item: Prioritizable): boolean {
  if (isDone(item)) return false;
  return item.status === "final_check" || (item.completionPct ?? 0) >= 100;
}

export function computePriority(item: Prioritizable, now = new Date()): Priority {
  if (item.completed || isDone(item)) return "done";
  if (item.priorityOverride === "high" || item.priorityOverride === "medium" || item.priorityOverride === "low") {
    return item.priorityOverride;
  }
  // Work that's finished but unsubmitted is never "low" — it's awaiting a
  // final check, which is a different kind of action, so it gets its own tag.
  if (isReview(item)) return "review";

  const score = priorityScore(item, now);
  if (score >= 32) return "high";
  if (score >= 18) return "medium";
  return "low";
}
