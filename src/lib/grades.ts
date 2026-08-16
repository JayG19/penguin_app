export interface GradeItemLike {
  weight: number;
  score: number | null;
  maxScore: number;
}

export interface GradeSummary {
  /** Average across graded items only, 0–100 (null if nothing graded). */
  currentGrade: number | null;
  /** Points already banked toward the final grade (sum of weight * pct). */
  earnedWeighted: number;
  /** Sum of weights of graded items. */
  gradedWeight: number;
  /** Sum of weights of ungraded items + unassigned weight up to 100. */
  remainingWeight: number;
}

export function summarizeGrades(items: GradeItemLike[]): GradeSummary {
  let earnedWeighted = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  for (const item of items) {
    totalWeight += item.weight;
    if (item.score != null && item.maxScore > 0) {
      const pct = (item.score / item.maxScore) * 100;
      earnedWeighted += (pct * item.weight) / 100;
      gradedWeight += item.weight;
    }
  }
  const remainingWeight = Math.max(0, 100 - gradedWeight);
  return {
    currentGrade: gradedWeight > 0 ? (earnedWeighted / gradedWeight) * 100 : null,
    earnedWeighted,
    gradedWeight,
    remainingWeight: Math.min(remainingWeight, Math.max(remainingWeight, totalWeight - gradedWeight)),
  };
}

/**
 * "What do I need on the rest to finish with target%?"
 * Returns required average (0–100+) on the remaining weight, or null if no weight remains.
 */
export function requiredOnRemaining(summary: GradeSummary, targetGrade: number): number | null {
  if (summary.remainingWeight <= 0) return null;
  return ((targetGrade - summary.earnedWeighted) / summary.remainingWeight) * 100;
}

/** Final grade if the student averages `assumedPct` on everything remaining. */
export function projectedFinal(summary: GradeSummary, assumedPct: number): number {
  return summary.earnedWeighted + (assumedPct * summary.remainingWeight) / 100;
}
