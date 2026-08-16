/**
 * Manual-edit bookkeeping for Brightspace-synced records.
 *
 * When the user edits a synced field we record the field name in
 * `overriddenFields`; the sync engine then stops touching that field and the
 * UI shows an "Overridden" badge. Restoring a field copies the last-synced
 * value back out of `brightspaceRaw` and clears the override.
 */

export const SYNCED_FIELDS: Record<string, string[]> = {
  assignment: ["title", "description", "dueAt", "weight", "brightspaceUrl"],
  quiz: ["title", "kind", "startAt", "durationMins", "weight", "location", "brightspaceUrl"],
  course: ["code", "name", "term", "description", "brightspaceUrl"],
  contact: ["name", "role", "email", "office", "officeHours"],
  grade: ["name", "category", "weight", "score", "maxScore", "gradedAt"],
  submission: ["status", "submittedAt", "grade", "feedback"],
};

// db field -> key inside the stored Brightspace DTO where names differ
const RAW_KEY_MAP: Record<string, string> = { brightspaceUrl: "url" };

const DATE_FIELDS = new Set(["dueAt", "startAt", "gradedAt", "submittedAt"]);

export function parseOverridden(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    return JSON.parse(s) as string[];
  } catch {
    return [];
  }
}

/**
 * Given a record being manually edited, returns the updated overriddenFields
 * JSON: any synced field present in `updates` becomes overridden.
 */
export function trackOverrides(
  entity: string,
  record: { source: string; overriddenFields: string | null },
  updates: Record<string, unknown>,
): string | null {
  if (record.source !== "brightspace") return record.overriddenFields;
  const synced = SYNCED_FIELDS[entity] ?? [];
  const current = new Set(parseOverridden(record.overriddenFields));
  for (const key of Object.keys(updates)) {
    if (synced.includes(key)) current.add(key);
  }
  return current.size ? JSON.stringify([...current]) : null;
}

/**
 * Restore selected fields to their last-synced Brightspace values.
 * Returns the field updates plus the shrunken overriddenFields JSON.
 */
export function restoreFields(
  record: { brightspaceRaw: string | null; overriddenFields: string | null },
  fields: string[],
): { updates: Record<string, unknown>; overriddenFields: string | null } {
  const raw: Record<string, unknown> = record.brightspaceRaw ? JSON.parse(record.brightspaceRaw) : {};
  const updates: Record<string, unknown> = {};
  for (const field of fields) {
    const rawKey = RAW_KEY_MAP[field] ?? field;
    let value = raw[rawKey] ?? null;
    if (value != null && DATE_FIELDS.has(field)) value = new Date(String(value));
    updates[field] = value;
  }
  const remaining = parseOverridden(record.overriddenFields).filter((f) => !fields.includes(f));
  return { updates, overriddenFields: remaining.length ? JSON.stringify(remaining) : null };
}
