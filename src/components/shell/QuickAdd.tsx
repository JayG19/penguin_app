"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BellRing, BookOpen, Calendar, ClipboardList, Contact, FileQuestion, Link2, Plus, StickyNote, AlarmClock,
} from "lucide-react";
import { Button, Input, Label, Modal, Select, Textarea, toast } from "@/components/ui";
import { cn } from "@/lib/utils";

type AddType =
  | "assignment" | "quiz" | "exam" | "task" | "reminder" | "note" | "event" | "course" | "contact" | "resource" | "announcement";

const TYPES: { type: AddType; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
  { type: "assignment", label: "Assignment", icon: ClipboardList },
  { type: "quiz", label: "Quiz", icon: FileQuestion },
  { type: "exam", label: "Exam", icon: FileQuestion },
  { type: "task", label: "Task", icon: ClipboardList },
  { type: "reminder", label: "Reminder", icon: AlarmClock },
  { type: "note", label: "Note", icon: StickyNote },
  { type: "event", label: "Calendar Event", icon: Calendar },
  { type: "course", label: "Course", icon: BookOpen },
  { type: "contact", label: "Professor / TA", icon: Contact },
  { type: "resource", label: "Resource", icon: Link2 },
  { type: "announcement", label: "Announcement", icon: BellRing },
];

interface CourseLite { id: string; code: string; name: string }

const RECUR_PRESETS: Record<string, { unit: string; interval: number }> = {
  daily: { unit: "daily", interval: 1 },
  weekly: { unit: "weekly", interval: 1 },
  biweekly: { unit: "weekly", interval: 2 },
  monthly: { unit: "monthly", interval: 1 },
};

export function QuickAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AddType | null>(null);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: AddType; courseId?: string }>).detail;
      setOpen(true);
      setType(detail?.type ?? null);
      setForm(detail?.courseId ? { courseId: detail.courseId } : {});
    };
    window.addEventListener("quickadd", onOpen);
    return () => window.removeEventListener("quickadd", onOpen);
  }, []);

  useEffect(() => {
    if (open && courses.length === 0) {
      fetch("/api/courses").then(async (r) => {
        if (r.ok) setCourses((await r.json()).courses);
      });
    }
  }, [open, courses.length]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setOpen(false);
    setType(null);
    setForm({});
    setSaving(false);
  }

  function isoOrNull(dateKey: string, timeKey: string): string | null {
    if (!form[dateKey]) return null;
    const time = form[timeKey] || "23:59";
    return new Date(`${form[dateKey]}T${time}`).toISOString();
  }

  async function save() {
    if (!type) return;
    setSaving(true);
    try {
      let url = "";
      let body: Record<string, unknown> = {};
      switch (type) {
        case "assignment":
          url = "/api/assignments";
          body = {
            courseId: form.courseId || courses[0]?.id,
            title: form.title,
            description: form.description || undefined,
            dueAt: isoOrNull("date", "time"),
            weight: form.weight ? Number(form.weight) : null,
            estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
          };
          break;
        case "quiz":
        case "exam":
          url = "/api/quizzes";
          body = {
            courseId: form.courseId || courses[0]?.id,
            title: form.title,
            kind: type === "exam" ? (form.kind || "exam") : "quiz",
            startAt: isoOrNull("date", "time"),
            durationMins: form.duration ? Number(form.duration) : null,
            location: form.location || null,
            topics: form.topics || null,
            weight: form.weight ? Number(form.weight) : null,
          };
          break;
        case "task":
        case "reminder":
          url = "/api/tasks";
          body = {
            title: form.title,
            kind: type,
            dueAt: isoOrNull("date", "time"),
            courseId: form.courseId || null,
            notes: form.notes || null,
          };
          break;
        case "note":
          url = "/api/notes";
          body = {
            title: form.title,
            body: form.body ?? "",
            courseId: form.courseId || null,
            topic: form.topic || null,
          };
          break;
        case "event": {
          const recur = !form.recurrence
            ? null
            : form.recurrence === "custom"
              ? { unit: form.recurrenceUnit || "weekly", interval: Math.max(1, Number(form.recurrenceInterval) || 1) }
              : RECUR_PRESETS[form.recurrence];
          url = "/api/events";
          body = {
            title: form.title,
            type: form.eventType || "personal",
            startAt: isoOrNull("date", "time") ?? new Date().toISOString(),
            endAt: form.endTime && form.date ? new Date(`${form.date}T${form.endTime}`).toISOString() : null,
            location: form.location || null,
            courseId: form.courseId || null,
            description: form.description || null,
            recurrenceUnit: recur?.unit ?? null,
            recurrenceInterval: recur?.interval ?? null,
            recurrenceUntil: recur && form.recurrenceUntil ? new Date(`${form.recurrenceUntil}T23:59:59`).toISOString() : null,
          };
          break;
        }
        case "course":
          url = "/api/courses";
          body = { code: form.code, name: form.title, term: form.term || "Fall 2026", description: form.description || null, color: form.color || "indigo" };
          break;
        case "contact":
          url = "/api/contacts";
          body = {
            courseId: form.courseId || courses[0]?.id,
            name: form.title,
            role: form.role || "professor",
            email: form.email || null,
            office: form.office || null,
            officeHours: form.officeHours || null,
            phone: form.phone || null,
          };
          break;
        case "resource":
          url = "/api/resources";
          body = { courseId: form.courseId || null, title: form.title, url: form.url, description: form.description || null };
          break;
        case "announcement":
          url = "/api/announcements";
          body = { courseId: form.courseId || courses[0]?.id, title: form.title, body: form.body ?? "", author: form.author || null };
          break;
      }
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        toast(`${TYPES.find((t) => t.type === type)?.label} created`);
        reset();
        router.refresh();
      } else {
        toast(data.error ?? "Could not save — check required fields", "error");
        setSaving(false);
      }
    } catch {
      toast("Could not save", "error");
      setSaving(false);
    }
  }

  const needsCourse = type && ["assignment", "quiz", "exam", "contact", "announcement"].includes(type);
  const optionalCourse = type && ["task", "reminder", "note", "event", "resource"].includes(type);

  const label = TYPES.find((t) => t.type === type)?.label;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setType(null); setForm({}); }}
        className="fixed bottom-16 lg:bottom-5 right-4 lg:right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white dark:text-zinc-900 shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Quick add"
      >
        <Plus size={22} />
      </button>

      <Modal open={open} onClose={reset} title={type ? `New ${label}` : "Add"} wide={type === "note"}>
        {!type ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => setType(t.type)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border-base bg-surface p-3.5 hover:border-border-strong hover:bg-surface-2 transition-colors"
              >
                <t.icon size={18} />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <form
            className="space-y-3.5"
            onSubmit={(e) => { e.preventDefault(); save(); }}
          >
            <div>
              <Label htmlFor="qa-title">{type === "contact" ? "Name" : type === "course" ? "Course name" : "Title"}</Label>
              <Input id="qa-title" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} required autoFocus />
            </div>

            {type === "course" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qa-code">Course code</Label>
                  <Input id="qa-code" placeholder="ADM2302" value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="qa-term">Term</Label>
                  <Input id="qa-term" placeholder="Fall 2026" value={form.term ?? ""} onChange={(e) => set("term", e.target.value)} />
                </div>
              </div>
            )}

            {(needsCourse || optionalCourse) && (
              <div>
                <Label htmlFor="qa-course">Course{optionalCourse ? " (optional)" : ""}</Label>
                <Select id="qa-course" value={form.courseId ?? ""} onChange={(e) => set("courseId", e.target.value)} required={!!needsCourse}>
                  {optionalCourse && <option value="">No course</option>}
                  {needsCourse && !form.courseId && <option value="">Select course…</option>}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </Select>
              </div>
            )}

            {type === "exam" && (
              <div>
                <Label htmlFor="qa-kind">Type</Label>
                <Select id="qa-kind" value={form.kind ?? "exam"} onChange={(e) => set("kind", e.target.value)}>
                  <option value="exam">Exam</option>
                  <option value="midterm">Midterm</option>
                  <option value="final">Final</option>
                </Select>
              </div>
            )}

            {type === "event" && (
              <div>
                <Label htmlFor="qa-etype">Event type</Label>
                <Select id="qa-etype" value={form.eventType ?? "personal"} onChange={(e) => set("eventType", e.target.value)}>
                  <option value="personal">Personal</option>
                  <option value="class">Class</option>
                  <option value="reminder">Reminder</option>
                  <option value="event">Event</option>
                </Select>
              </div>
            )}

            {type === "contact" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qa-role">Role</Label>
                    <Select id="qa-role" value={form.role ?? "professor"} onChange={(e) => set("role", e.target.value)}>
                      <option value="professor">Professor</option>
                      <option value="ta">TA</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="qa-email">Email</Label>
                    <Input id="qa-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qa-office">Office</Label>
                    <Input id="qa-office" value={form.office ?? ""} onChange={(e) => set("office", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="qa-oh">Office hours</Label>
                    <Input id="qa-oh" value={form.officeHours ?? ""} onChange={(e) => set("officeHours", e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {type === "resource" && (
              <div>
                <Label htmlFor="qa-url">URL</Label>
                <Input id="qa-url" type="url" placeholder="https://…" value={form.url ?? ""} onChange={(e) => set("url", e.target.value)} required />
              </div>
            )}

            {["assignment", "quiz", "exam", "task", "reminder", "event"].includes(type) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qa-date">{type === "event" ? "Date" : "Due / date"}</Label>
                  <Input id="qa-date" type="date" value={form.date ?? ""} onChange={(e) => set("date", e.target.value)} required={type === "event"} />
                </div>
                <div>
                  <Label htmlFor="qa-time">Time</Label>
                  <Input id="qa-time" type="time" value={form.time ?? ""} onChange={(e) => set("time", e.target.value)} />
                </div>
              </div>
            )}

            {type === "event" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qa-endtime">End time</Label>
                  <Input id="qa-endtime" type="time" value={form.endTime ?? ""} onChange={(e) => set("endTime", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="qa-loc">Location</Label>
                  <Input id="qa-loc" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
                </div>
              </div>
            )}

            {type === "event" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qa-recur">Repeats</Label>
                    <Select id="qa-recur" value={form.recurrence ?? ""} onChange={(e) => set("recurrence", e.target.value)}>
                      <option value="">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom…</option>
                    </Select>
                  </div>
                  {form.recurrence && (
                    <div>
                      <Label htmlFor="qa-recur-until">Repeat until (optional)</Label>
                      <Input id="qa-recur-until" type="date" value={form.recurrenceUntil ?? ""} onChange={(e) => set("recurrenceUntil", e.target.value)} />
                    </div>
                  )}
                </div>
                {form.recurrence === "custom" && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="qa-recur-interval" className="mb-0 shrink-0">Every</Label>
                    <Input
                      id="qa-recur-interval"
                      type="number"
                      min={1}
                      max={99}
                      value={form.recurrenceInterval ?? "1"}
                      onChange={(e) => set("recurrenceInterval", e.target.value)}
                      className="w-16"
                    />
                    <Select
                      id="qa-recur-unit"
                      value={form.recurrenceUnit ?? "weekly"}
                      onChange={(e) => set("recurrenceUnit", e.target.value)}
                      className="w-auto"
                      aria-label="Recurrence unit"
                    >
                      <option value="daily">day(s)</option>
                      <option value="weekly">week(s)</option>
                      <option value="monthly">month(s)</option>
                    </Select>
                    <span className="text-xs text-muted">on {form.date ? new Date(`${form.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" }) : "the chosen date"}</span>
                  </div>
                )}
              </div>
            )}

            {["quiz", "exam"].includes(type) && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="qa-weight">Weight %</Label>
                  <Input id="qa-weight" type="number" min={0} max={100} step="0.5" value={form.weight ?? ""} onChange={(e) => set("weight", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="qa-duration">Duration (min)</Label>
                  <Input id="qa-duration" type="number" min={1} value={form.duration ?? ""} onChange={(e) => set("duration", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="qa-loc2">Location</Label>
                  <Input id="qa-loc2" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
                </div>
              </div>
            )}

            {["quiz", "exam"].includes(type) && (
              <div>
                <Label htmlFor="qa-topics">Topics</Label>
                <Input id="qa-topics" placeholder="Chapters, units…" value={form.topics ?? ""} onChange={(e) => set("topics", e.target.value)} />
              </div>
            )}

            {type === "assignment" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="qa-aweight">Weight %</Label>
                  <Input id="qa-aweight" type="number" min={0} max={100} step="0.5" value={form.weight ?? ""} onChange={(e) => set("weight", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="qa-hours">Estimated hours</Label>
                  <Input id="qa-hours" type="number" min={0} step="0.5" value={form.estimatedHours ?? ""} onChange={(e) => set("estimatedHours", e.target.value)} />
                </div>
              </div>
            )}

            {type === "note" && (
              <>
                <div>
                  <Label htmlFor="qa-topic">Topic (optional)</Label>
                  <Input id="qa-topic" value={form.topic ?? ""} onChange={(e) => set("topic", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="qa-body">Note (markdown supported)</Label>
                  <Textarea id="qa-body" rows={8} value={form.body ?? ""} onChange={(e) => set("body", e.target.value)} placeholder={"# Heading\n- [ ] checklist item\n**bold**, `code`…"} />
                </div>
              </>
            )}

            {type === "announcement" && (
              <>
                <div>
                  <Label htmlFor="qa-author">Author (optional)</Label>
                  <Input id="qa-author" value={form.author ?? ""} onChange={(e) => set("author", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="qa-abody">Content</Label>
                  <Textarea id="qa-abody" rows={5} value={form.body ?? ""} onChange={(e) => set("body", e.target.value)} />
                </div>
              </>
            )}

            {["assignment", "course", "event", "resource"].includes(type) && (
              <div>
                <Label htmlFor="qa-desc">Description (optional)</Label>
                <Textarea id="qa-desc" rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </div>
            )}

            {["task", "reminder"].includes(type) && (
              <div>
                <Label htmlFor="qa-notes">Notes (optional)</Label>
                <Textarea id="qa-notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            )}

            <div className={cn("flex items-center gap-2 pt-1", "justify-between")}>
              <Button type="button" variant="ghost" onClick={() => setType(null)}>← Back</Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
