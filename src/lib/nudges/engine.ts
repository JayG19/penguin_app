import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DONE_STATUSES } from "@/lib/priority";
import { applyQuietHours, parseNudgePrefs, type NudgePrefs } from "./prefs";

interface Candidate {
  title: string;
  body: string;
  remindAt: Date;
  category: string;
  entityType: string;
  entityId: string;
}

function hoursBefore(target: Date, hours: number): Date {
  return new Date(target.getTime() - hours * 3600_000);
}

function leadLabel(hours: number): string {
  if (hours >= 48) return `in ${Math.round(hours / 24)} days`;
  if (hours >= 24) return "tomorrow";
  return `in ${hours} hours`;
}

/**
 * Derives the automatic nudges a user should have right now and upserts them.
 *
 * Each (entity, lead time) pair maps to one stable nudge row, so re-scanning is
 * idempotent — a nudge the user already dismissed is never resurrected, and a
 * deadline that moves has its pending reminder moved with it.
 */
export async function scanNudges(userId: string): Promise<{ created: number; updated: number }> {
  const pref = await db.userPreference.findUnique({ where: { userId } });
  const prefs: NudgePrefs = parseNudgePrefs(pref?.nudgePrefs);
  const timezone = pref?.timezone ?? null;
  if (!prefs.enabled) return { created: 0, updated: 0 };

  const now = new Date();
  const horizon = new Date(now.getTime() + Math.max(...prefs.leadHours) * 3600_000);
  const candidates: Candidate[] = [];

  const push = (base: Omit<Candidate, "remindAt" | "category">, due: Date, category: string) => {
    for (const lead of prefs.leadHours) {
      const remindAt = hoursBefore(due, lead);
      // Only schedule leads that haven't already elapsed.
      if (remindAt < now || due < now) continue;
      candidates.push({
        ...base,
        category: `${category}:${lead}`,
        remindAt: applyQuietHours(remindAt, prefs, timezone),
        body: `${base.body} — due ${leadLabel(lead)}`,
      });
    }
  };

  if (prefs.categories.deadline) {
    const assignments = await db.assignment.findMany({
      where: {
        course: { userId },
        status: { notIn: DONE_STATUSES },
        dueAt: { gte: now, lte: horizon },
      },
      include: { course: { select: { code: true } } },
    });
    for (const a of assignments) {
      if ((a.weight ?? 0) < prefs.minWeight) continue;
      push(
        {
          title: `${a.course.code}: ${a.title}`,
          body: `${a.weight != null ? `${a.weight}% of your grade` : "Assignment"}`,
          entityType: "assignment",
          entityId: a.id,
        },
        a.dueAt!,
        "deadline",
      );
    }

    const tasks = await db.task.findMany({
      where: { userId, completed: false, dueAt: { gte: now, lte: horizon } },
      include: { course: { select: { code: true } } },
    });
    for (const t of tasks) {
      push(
        { title: t.course ? `${t.course.code}: ${t.title}` : t.title, body: "Task", entityType: "task", entityId: t.id },
        t.dueAt!,
        "deadline",
      );
    }
  }

  if (prefs.categories.exam) {
    const quizzes = await db.quiz.findMany({
      where: { course: { userId }, status: "upcoming", startAt: { gte: now, lte: horizon } },
      include: { course: { select: { code: true } } },
    });
    for (const q of quizzes) {
      if ((q.weight ?? 0) < prefs.minWeight) continue;
      push(
        {
          title: `${q.course.code}: ${q.title}`,
          body: [q.kind === "quiz" ? "Quiz" : "Exam", q.weight ? `${q.weight}%` : null, q.location].filter(Boolean).join(" · "),
          entityType: "quiz",
          entityId: q.id,
        },
        q.startAt!,
        "exam",
      );
    }
  }

  // Announcements can't be scheduled ahead — they nudge once, on arrival,
  // and only while still unread.
  if (prefs.categories.announcement) {
    const since = new Date(now.getTime() - 48 * 3600_000);
    const announcements = await db.announcement.findMany({
      where: { course: { userId }, read: false, postedAt: { gte: since } },
      include: { course: { select: { code: true } } },
    });
    for (const an of announcements) {
      candidates.push({
        title: `${an.course.code}: ${an.title}`,
        body: an.author ? `New announcement from ${an.author}` : "New announcement",
        remindAt: applyQuietHours(now, prefs, timezone),
        category: "announcement",
        entityType: "announcement",
        entityId: an.id,
      });
    }
  }

  if (prefs.categories.grade) {
    const since = new Date(now.getTime() - 48 * 3600_000);
    const grades = await db.gradeItem.findMany({
      where: { course: { userId }, gradedAt: { gte: since }, score: { not: null } },
      include: { course: { select: { code: true } } },
    });
    for (const g of grades) {
      candidates.push({
        title: `${g.course.code}: ${g.name} graded`,
        body: `${g.score}/${g.maxScore}`,
        remindAt: applyQuietHours(now, prefs, timezone),
        category: "grade",
        entityType: "grade",
        entityId: g.id,
      });
    }
  }

  let created = 0;
  let updated = 0;
  for (const c of candidates) {
    const existing = await db.nudge.findFirst({
      where: { userId, entityType: c.entityType, entityId: c.entityId, category: c.category, kind: "auto" },
    });
    if (existing) {
      if (
        !existing.dismissed &&
        // Only deadline-derived nudges track their source date. Announcement and
        // grade nudges fire "now", so re-timing them on every scan would keep
        // pushing them forward and they'd never settle.
        /:\d+$/.test(c.category) &&
        existing.remindAt.getTime() !== c.remindAt.getTime()
      ) {
        await db.nudge.update({ where: { id: existing.id }, data: { remindAt: c.remindAt, body: c.body } });
        updated++;
      }
      continue;
    }
    try {
      await db.nudge.create({ data: { userId, kind: "auto", ...c } });
      created++;
    } catch (err) {
      // Two concurrent scans (background polling + a page load both
      // triggering a scan) can each pass the findFirst check before either
      // creates — the unique constraint already guarantees only one row
      // ever exists, so this race is safe to swallow.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  }

  // Clean up auto nudges whose source item is gone or already handled.
  const stale = await db.nudge.findMany({ where: { userId, kind: "auto", dismissed: false } });
  for (const n of stale) {
    let gone = false;
    if (n.entityType === "assignment") {
      const a = await db.assignment.findUnique({ where: { id: n.entityId! } });
      gone = !a || DONE_STATUSES.includes(a.status);
    } else if (n.entityType === "quiz") {
      const q = await db.quiz.findUnique({ where: { id: n.entityId! } });
      gone = !q || q.status !== "upcoming";
    } else if (n.entityType === "announcement") {
      const an = await db.announcement.findUnique({ where: { id: n.entityId! } });
      gone = !an || an.read;
    } else if (n.entityType === "task") {
      const t = await db.task.findUnique({ where: { id: n.entityId! } });
      gone = !t || t.completed;
    }
    if (gone) await db.nudge.update({ where: { id: n.id }, data: { dismissed: true } });
  }

  return { created, updated };
}
