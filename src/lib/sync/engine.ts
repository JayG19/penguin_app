import { db } from "@/lib/db";
import { getBrightspaceService } from "@/lib/brightspace/BrightspaceService";
import { brightspaceEnabled } from "@/lib/brightspace/config";

export interface SyncDetail {
  action: "added" | "updated" | "removed" | "conflict";
  entity: string; // assignment | quiz | announcement | grade | course | contact | content | resource | submission
  label: string;
  courseCode?: string;
  entityType?: string;
  entityId?: string;
  field?: string;
}

export interface SyncResult {
  logId: string;
  status: "success" | "error";
  added: number;
  updated: number;
  removed: number;
  errors: number;
  details: SyncDetail[];
}

type Json = Record<string, unknown>;

function parseOverrides(s: string | null | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s) as string[]; } catch { return []; }
}

/**
 * Applies incoming Brightspace values to an existing record while respecting
 * user overrides: a field the user edited locally is never overwritten — the
 * new remote value is kept in `brightspaceRaw` so the UI can show "Overridden"
 * with a "Restore Brightspace value" action.
 */
function diffFields(
  existing: Record<string, unknown>,
  incoming: Json,
  overridden: string[],
): { updates: Json; conflicts: string[]; changed: boolean } {
  const updates: Json = {};
  const conflicts: string[] = [];
  let changed = false;
  for (const [field, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    const current = existing[field];
    const a = current instanceof Date ? current.toISOString() : current ?? null;
    const b = value instanceof Date ? value.toISOString() : value ?? null;
    if (a === b) continue;
    if (overridden.includes(field)) {
      conflicts.push(field);
    } else {
      updates[field] = value;
      changed = true;
    }
  }
  return { updates, conflicts, changed };
}

function d(iso: string | undefined | null): Date | null {
  return iso ? new Date(iso) : null;
}

export async function runSync(userId: string): Promise<SyncResult> {
  // Manual mode: no source is configured, so there is nothing to sync and
  // nothing should be written.
  if (!brightspaceEnabled()) {
    return { logId: "", status: "error", added: 0, updated: 0, removed: 0, errors: 1, details: [] };
  }
  const generation = await db.syncLog.count({ where: { userId, status: "success" } });
  const service = getBrightspaceService(generation, userId);
  const log = await db.syncLog.create({ data: { userId, status: "running" } });

  const details: SyncDetail[] = [];
  let added = 0, updated = 0, removed = 0, errors = 0;
  const notifications: { type: string; title: string; body?: string; entityType?: string; entityId?: string }[] = [];

  const bump = (detail: SyncDetail) => {
    details.push(detail);
    if (detail.action === "added") added++;
    else if (detail.action === "updated" || detail.action === "conflict") updated++;
    else if (detail.action === "removed") removed++;
  };

  try {
    const bsCourses = await service.getCourses();

    for (const bsCourse of bsCourses) {
      // ---- Course ----
      let course = await db.course.findUnique({ where: { externalId: bsCourse.externalId } });
      const courseData = {
        code: bsCourse.code,
        name: bsCourse.name,
        term: bsCourse.term || undefined,
        description: bsCourse.description ?? null,
        brightspaceUrl: bsCourse.url ?? null,
      };
      if (!course) {
        const palette = ["indigo", "emerald", "amber", "rose", "sky", "violet"];
        const count = await db.course.count({ where: { userId } });
        course = await db.course.create({
          data: {
            userId,
            ...courseData,
            term: bsCourse.term || "Fall 2026",
            color: palette[count % palette.length],
            source: "brightspace",
            externalId: bsCourse.externalId,
            brightspaceRaw: JSON.stringify(bsCourse),
          },
        });
        await db.enrollment.upsert({
          where: { userId_courseId: { userId, courseId: course.id } },
          create: { userId, courseId: course.id },
          update: {},
        });
        bump({ action: "added", entity: "course", label: `${bsCourse.code} — ${bsCourse.name}`, courseCode: bsCourse.code, entityType: "course", entityId: course.id });
      } else {
        const { updates, conflicts, changed } = diffFields(course, courseData, parseOverrides(course.overriddenFields));
        if (changed || conflicts.length) {
          await db.course.update({ where: { id: course.id }, data: { ...updates, brightspaceRaw: JSON.stringify(bsCourse) } });
          if (changed) bump({ action: "updated", entity: "course", label: bsCourse.code, courseCode: bsCourse.code, entityType: "course", entityId: course.id });
          for (const f of conflicts) bump({ action: "conflict", entity: "course", label: bsCourse.code, courseCode: bsCourse.code, field: f, entityType: "course", entityId: course.id });
        }
      }
      const courseId = course.id;
      const code = course.code;

      // ---- Contacts ----
      const contacts = await service.getUsers(bsCourse.externalId);
      for (const c of contacts) {
        const existing = await db.contact.findUnique({ where: { externalId: c.externalId } });
        const data = { name: c.name, role: c.role, email: c.email ?? null, office: c.office ?? null, officeHours: c.officeHours ?? null };
        if (!existing) {
          const rec = await db.contact.create({ data: { courseId, ...data, source: "brightspace", externalId: c.externalId, brightspaceRaw: JSON.stringify(c) } });
          bump({ action: "added", entity: "contact", label: c.name, courseCode: code, entityType: "contact", entityId: rec.id });
        } else {
          const { updates, conflicts, changed } = diffFields(existing, data, parseOverrides(existing.overriddenFields));
          if (changed || conflicts.length) {
            await db.contact.update({ where: { id: existing.id }, data: { ...updates, brightspaceRaw: JSON.stringify(c) } });
            if (changed) bump({ action: "updated", entity: "contact", label: c.name, courseCode: code, entityType: "contact", entityId: existing.id });
          }
        }
      }

      // ---- Content ----
      const modules = await service.getCourseContent(bsCourse.externalId);
      for (const m of modules) {
        let mod = await db.contentModule.findUnique({ where: { externalId: m.externalId } });
        if (!mod) {
          mod = await db.contentModule.create({ data: { courseId, title: m.title, order: m.order, source: "brightspace", externalId: m.externalId } });
          bump({ action: "added", entity: "content", label: m.title, courseCode: code, entityType: "module", entityId: mod.id });
        } else if (mod.title !== m.title || mod.order !== m.order) {
          await db.contentModule.update({ where: { id: mod.id }, data: { title: m.title, order: m.order } });
        }
        for (const item of m.items) {
          const existing = await db.contentItem.findUnique({ where: { externalId: item.externalId } });
          const data = { title: item.title, type: item.type, url: item.url ?? null, order: item.order };
          if (!existing) {
            const rec = await db.contentItem.create({ data: { moduleId: mod.id, ...data, source: "brightspace", externalId: item.externalId } });
            bump({ action: "added", entity: "content", label: item.title, courseCode: code, entityType: "contentItem", entityId: rec.id });
            if (generation > 0) notifications.push({ type: "content_updated", title: `${code}: new content`, body: item.title, entityType: "course", entityId: courseId });
          } else {
            const { updates, changed } = diffFields(existing, data, []);
            if (changed) {
              await db.contentItem.update({ where: { id: existing.id }, data: { ...updates, updatedAt: new Date() } });
              bump({ action: "updated", entity: "content", label: item.title, courseCode: code, entityType: "contentItem", entityId: existing.id });
            }
          }
        }
      }

      // ---- Assignments (+ submissions) ----
      const assignments = await service.getAssignments(bsCourse.externalId);
      for (const a of assignments) {
        const existing = await db.assignment.findUnique({ where: { externalId: a.externalId } });
        const data = {
          title: a.title,
          description: a.description ?? null,
          dueAt: d(a.dueAt),
          weight: a.weight ?? null,
          brightspaceUrl: a.url ?? null,
        };
        let assignmentId: string;
        if (!existing) {
          const rec = await db.assignment.create({ data: { courseId, ...data, source: "brightspace", externalId: a.externalId, brightspaceRaw: JSON.stringify(a) } });
          assignmentId = rec.id;
          bump({ action: "added", entity: "assignment", label: a.title, courseCode: code, entityType: "assignment", entityId: rec.id });
          if (generation > 0) notifications.push({ type: "new_assignment", title: `${code}: new assignment`, body: a.title, entityType: "assignment", entityId: rec.id });
        } else {
          assignmentId = existing.id;
          const { updates, conflicts, changed } = diffFields(existing, data, parseOverrides(existing.overriddenFields));
          if (changed || conflicts.length) {
            await db.assignment.update({ where: { id: existing.id }, data: { ...updates, brightspaceRaw: JSON.stringify(a) } });
            if (changed) bump({ action: "updated", entity: "assignment", label: a.title, courseCode: code, entityType: "assignment", entityId: existing.id });
            for (const f of conflicts) bump({ action: "conflict", entity: "assignment", label: a.title, courseCode: code, field: f, entityType: "assignment", entityId: existing.id });
          }
        }
        if (a.submission) {
          const sub = await db.submission.findUnique({ where: { assignmentId } });
          const sdata = {
            status: a.submission.status,
            submittedAt: d(a.submission.submittedAt),
            grade: a.submission.grade ?? null,
            feedback: a.submission.feedback ?? null,
          };
          if (!sub) {
            await db.submission.create({ data: { assignmentId, ...sdata, source: "brightspace", externalId: `sub-${a.externalId}`, brightspaceRaw: JSON.stringify(a.submission) } });
            if (sdata.status !== "not_submitted") bump({ action: "added", entity: "submission", label: a.title, courseCode: code, entityType: "assignment", entityId: assignmentId });
          } else {
            const { updates, conflicts, changed } = diffFields(sub, sdata, parseOverrides(sub.overriddenFields));
            if (changed || conflicts.length) {
              await db.submission.update({ where: { id: sub.id }, data: { ...updates, brightspaceRaw: JSON.stringify(a.submission) } });
              if (changed) bump({ action: "updated", entity: "submission", label: a.title, courseCode: code, entityType: "assignment", entityId: assignmentId });
            }
          }
          // Submitted/graded in Brightspace implies done locally unless user set status manually
          if ((sdata.status === "submitted" || sdata.status === "graded") ) {
            const rec = await db.assignment.findUnique({ where: { id: assignmentId } });
            if (rec && !parseOverrides(rec.overriddenFields).includes("status") && rec.status !== "submitted" && rec.status !== "completed") {
              await db.assignment.update({ where: { id: assignmentId }, data: { status: "submitted", completionPct: 100 } });
            }
          }
        }
      }

      // ---- Quizzes ----
      const quizzes = await service.getQuizzes(bsCourse.externalId);
      for (const q of quizzes) {
        const existing = await db.quiz.findUnique({ where: { externalId: q.externalId } });
        const data = {
          title: q.title,
          kind: q.kind,
          startAt: d(q.startAt),
          durationMins: q.durationMins ?? null,
          weight: q.weight ?? null,
          location: q.location ?? null,
          brightspaceUrl: q.url ?? null,
        };
        if (!existing) {
          const rec = await db.quiz.create({ data: { courseId, ...data, source: "brightspace", externalId: q.externalId, brightspaceRaw: JSON.stringify(q) } });
          bump({ action: "added", entity: "quiz", label: q.title, courseCode: code, entityType: "quiz", entityId: rec.id });
          if (generation > 0) notifications.push({ type: "new_quiz", title: `${code}: new ${q.kind}`, body: q.title, entityType: "quiz", entityId: rec.id });
        } else {
          const { updates, conflicts, changed } = diffFields(existing, data, parseOverrides(existing.overriddenFields));
          if (changed || conflicts.length) {
            await db.quiz.update({ where: { id: existing.id }, data: { ...updates, brightspaceRaw: JSON.stringify(q) } });
            if (changed) {
              bump({ action: "updated", entity: "quiz", label: q.title, courseCode: code, entityType: "quiz", entityId: existing.id });
              if ("startAt" in updates) notifications.push({ type: "deadline", title: `${code}: ${q.title} date changed`, body: `New date: ${new Date(String(updates.startAt ?? "")).toLocaleString()}`, entityType: "quiz", entityId: existing.id });
            }
            for (const f of conflicts) bump({ action: "conflict", entity: "quiz", label: q.title, courseCode: code, field: f, entityType: "quiz", entityId: existing.id });
          }
        }
      }

      // ---- Announcements ----
      const announcements = await service.getAnnouncements(bsCourse.externalId);
      for (const an of announcements) {
        const existing = await db.announcement.findUnique({ where: { externalId: an.externalId } });
        if (!existing) {
          const rec = await db.announcement.create({
            data: { courseId, title: an.title, body: an.body, author: an.author ?? null, postedAt: new Date(an.postedAt), brightspaceUrl: an.url ?? null, source: "brightspace", externalId: an.externalId, read: generation === 0 && new Date(an.postedAt) < new Date(Date.now() - 7 * 864e5) },
          });
          bump({ action: "added", entity: "announcement", label: an.title, courseCode: code, entityType: "announcement", entityId: rec.id });
          if (generation > 0) notifications.push({ type: "new_announcement", title: `${code}: ${an.author ?? "announcement"}`, body: an.title, entityType: "announcement", entityId: rec.id });
        } else if (existing.title !== an.title || existing.body !== an.body) {
          await db.announcement.update({ where: { id: existing.id }, data: { title: an.title, body: an.body } });
          bump({ action: "updated", entity: "announcement", label: an.title, courseCode: code, entityType: "announcement", entityId: existing.id });
        }
      }

      // ---- Grades ----
      const grades = await service.getGrades(bsCourse.externalId);
      for (const g of grades) {
        const existing = await db.gradeItem.findUnique({ where: { externalId: g.externalId } });
        const data = { name: g.name, category: g.category, weight: g.weight, score: g.score ?? null, maxScore: g.maxScore, gradedAt: d(g.gradedAt) };
        if (!existing) {
          const rec = await db.gradeItem.create({ data: { courseId, ...data, source: "brightspace", externalId: g.externalId, brightspaceRaw: JSON.stringify(g) } });
          bump({ action: "added", entity: "grade", label: g.name, courseCode: code, entityType: "grade", entityId: rec.id });
        } else {
          const { updates, conflicts, changed } = diffFields(existing, data, parseOverrides(existing.overriddenFields));
          if (changed || conflicts.length) {
            await db.gradeItem.update({ where: { id: existing.id }, data: { ...updates, brightspaceRaw: JSON.stringify(g) } });
            if (changed) {
              bump({ action: "updated", entity: "grade", label: g.name, courseCode: code, entityType: "grade", entityId: existing.id });
              if ("score" in updates && updates.score != null) {
                notifications.push({ type: "grade_posted", title: `${code}: grade posted`, body: `${g.name}: ${g.score}/${g.maxScore}`, entityType: "course", entityId: courseId });
              }
            }
          }
        }
      }

      // ---- Resources ----
      const resources = await service.getResources(bsCourse.externalId);
      for (const r of resources) {
        const existing = await db.resource.findUnique({ where: { externalId: r.externalId } });
        if (!existing) {
          const rec = await db.resource.create({ data: { courseId, title: r.title, url: r.url, description: r.description ?? null, source: "brightspace", externalId: r.externalId } });
          bump({ action: "added", entity: "resource", label: r.title, courseCode: code, entityType: "resource", entityId: rec.id });
        }
      }

      // ---- Removals: brightspace records that vanished remotely ----
      const keep = new Set([
        ...assignments.map((x) => x.externalId),
        ...quizzes.map((x) => x.externalId),
        ...announcements.map((x) => x.externalId),
      ]);
      const staleAssignments = await db.assignment.findMany({ where: { courseId, source: "brightspace", externalId: { notIn: assignments.map((x) => x.externalId) } } });
      for (const s of staleAssignments) {
        await db.assignment.delete({ where: { id: s.id } });
        bump({ action: "removed", entity: "assignment", label: s.title, courseCode: code });
      }
      const staleQuizzes = await db.quiz.findMany({ where: { courseId, source: "brightspace", externalId: { notIn: quizzes.map((x) => x.externalId) } } });
      for (const s of staleQuizzes) {
        await db.quiz.delete({ where: { id: s.id } });
        bump({ action: "removed", entity: "quiz", label: s.title, courseCode: code });
      }
      void keep;

      // ---- Course progress: share of weight already graded + submitted work ----
      const [allA, gradeRows] = await Promise.all([
        db.assignment.findMany({ where: { courseId } }),
        db.gradeItem.findMany({ where: { courseId } }),
      ]);
      const gradedWeight = gradeRows.filter((g) => g.score != null).reduce((s, g) => s + g.weight, 0);
      const doneShare = allA.length ? allA.filter((x) => ["submitted", "completed"].includes(x.status)).length / allA.length : 0;
      const progress = Math.min(1, gradedWeight / 100 + doneShare * 0.2);
      await db.course.update({ where: { id: courseId }, data: { progress } });
    }

    for (const n of notifications) {
      await db.notification.create({ data: { userId, ...n } });
    }

    await db.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), status: "success", added, updated, removed, errors, details: JSON.stringify(details) },
    });
    return { logId: log.id, status: "success", added, updated, removed, errors, details };
  } catch (e) {
    errors++;
    const message = e instanceof Error ? e.message : "Unknown sync error";
    details.push({ action: "removed", entity: "error", label: message });
    await db.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), status: "error", added, updated, removed, errors, details: JSON.stringify([{ action: "error", entity: "error", label: message }]) },
    });
    await db.notification.create({ data: { userId, type: "sync_error", title: "Brightspace sync failed", body: message } });
    return { logId: log.id, status: "error", added, updated, removed, errors, details };
  }
}
