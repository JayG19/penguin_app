"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Pin, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Label, Select, Textarea, toast } from "@/components/ui";
import type { CourseDTO, NoteDTO } from "@/components/types";
import { renderMarkdown } from "@/lib/markdown";
import { cn, courseColor, timeAgo } from "@/lib/utils";

interface LinkTarget { id: string; title: string; courseId: string }

export function NotesClient({
  notes: initialNotes, courses, assignments, quizzes,
}: {
  notes: NoteDTO[];
  courses: CourseDTO[];
  assignments: LinkTarget[];
  quizzes: LinkTarget[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [notes, setNotes] = useState(initialNotes);
  const [q, setQ] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string; topic: string; courseId: string; assignmentId: string; quizId: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => setNotes(initialNotes), [initialNotes]);

  useEffect(() => {
    const openId = params.get("open");
    if (openId && initialNotes.some((n) => n.id === openId)) selectNote(initialNotes.find((n) => n.id === openId)!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(
    () =>
      notes
        .filter((n) => !courseFilter || n.courseId === courseFilter)
        .filter((n) => !q || `${n.title} ${n.body} ${n.topic ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [notes, q, courseFilter],
  );

  const active = notes.find((n) => n.id === activeId) ?? null;

  function selectNote(n: NoteDTO) {
    setActiveId(n.id);
    setDraft({
      title: n.title,
      body: n.body,
      topic: n.topic ?? "",
      courseId: n.courseId ?? "",
      assignmentId: n.assignmentId ?? "",
      quizId: n.quizId ?? "",
    });
    setPreview(false);
  }

  async function createNote() {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled note", body: "" }),
    });
    if (res.ok) {
      const n = (await res.json()).note;
      setNotes((prev) => [n, ...prev]);
      selectNote(n);
    }
  }

  async function saveDraft() {
    if (!active || !draft) return;
    const res = await fetch(`/api/notes/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title || "Untitled note",
        body: draft.body,
        topic: draft.topic || null,
        courseId: draft.courseId || null,
        assignmentId: draft.assignmentId || null,
        quizId: draft.quizId || null,
      }),
    });
    if (res.ok) {
      const n = (await res.json()).note;
      setNotes((prev) => prev.map((x) => (x.id === n.id ? n : x)));
      toast("Note saved");
      router.refresh();
    }
  }

  async function togglePin(n: NoteDTO) {
    const res = await fetch(`/api/notes/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !n.pinned }) });
    if (res.ok) {
      const updated = (await res.json()).note;
      setNotes((prev) => prev.map((x) => (x.id === n.id ? updated : x)));
    }
  }

  async function remove(n: NoteDTO) {
    if (!confirm(`Delete "${n.title}"?`)) return;
    await fetch(`/api/notes/${n.id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
    if (activeId === n.id) { setActiveId(null); setDraft(null); }
    toast("Note deleted");
  }

  const dirty = active && draft && (draft.title !== active.title || draft.body !== active.body || draft.topic !== (active.topic ?? "") || draft.courseId !== (active.courseId ?? "") || draft.assignmentId !== (active.assignmentId ?? "") || draft.quizId !== (active.quizId ?? ""));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Notes</h1>
          <p className="text-[13px] text-muted">{notes.length} notes · markdown supported</p>
        </div>
        <Button size="sm" variant="primary" onClick={createNote}><Plus size={14} /> New Note</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 items-start">
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative grow">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="pl-8" aria-label="Search notes" />
            </div>
            <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-24" aria-label="Filter by course">
              <option value="">All</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <Card><EmptyState icon={<StickyNote size={24} />} title="No notes found" actions={<Button size="sm" variant="outline" onClick={createNote}>Create note</Button>} /></Card>
            )}
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => selectNote(n)}
                className={cn(
                  "w-full text-left rounded-xl border p-3 transition-colors",
                  activeId === n.id ? "border-accent/50 bg-accent-soft" : "border-border-base bg-surface hover:border-border-strong",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Pin size={11} className="text-accent shrink-0" />}
                  <span className="text-[13px] font-medium truncate">{n.title}</span>
                </div>
                <p className="text-xs text-muted truncate mt-0.5">{n.body.replace(/[#*`>\-[\]]/g, "").slice(0, 60) || "Empty note"}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {n.course && <Badge className={cn(courseColor(n.course.color).soft, courseColor(n.course.color).text)}>{n.course.code}</Badge>}
                  {n.topic && <Badge>{n.topic}</Badge>}
                  <span className="text-[10px] text-faint ml-auto">{timeAgo(n.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {active && draft ? (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="font-medium grow" aria-label="Note title" />
              <Button size="sm" variant="ghost" onClick={() => togglePin(active)} aria-label={active.pinned ? "Unpin" : "Pin"}>
                <Pin size={14} className={active.pinned ? "text-accent" : ""} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(active)} className="text-rose-600 dark:text-rose-400" aria-label="Delete note">
                <Trash2 size={14} />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div>
                <Label htmlFor="n-course">Course</Label>
                <Select id="n-course" value={draft.courseId} onChange={(e) => setDraft({ ...draft, courseId: e.target.value, assignmentId: "", quizId: "" })}>
                  <option value="">None</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="n-topic">Topic</Label>
                <Input id="n-topic" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} placeholder="Topic" />
              </div>
              <div>
                <Label htmlFor="n-assignment">Assignment</Label>
                <Select id="n-assignment" value={draft.assignmentId} onChange={(e) => setDraft({ ...draft, assignmentId: e.target.value })}>
                  <option value="">None</option>
                  {assignments.filter((a) => !draft.courseId || a.courseId === draft.courseId).map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="n-quiz">Quiz / Exam</Label>
                <Select id="n-quiz" value={draft.quizId} onChange={(e) => setDraft({ ...draft, quizId: e.target.value })}>
                  <option value="">None</option>
                  {quizzes.filter((x) => !draft.courseId || x.courseId === draft.courseId).map((x) => (
                    <option key={x.id} value={x.id}>{x.title}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Button size="xs" variant={preview ? "outline" : "secondary"} onClick={() => setPreview(false)}>Write</Button>
              <Button size="xs" variant={preview ? "secondary" : "outline"} onClick={() => setPreview(true)}>Preview</Button>
              <span className="grow" />
              <Button size="xs" variant="ghost" onClick={() => setShowGuide((v) => !v)} aria-expanded={showGuide}>
                <HelpCircle size={12} /> Formatting help
                {showGuide ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </Button>
            </div>
            {showGuide && <FormattingGuide onInsert={(snippet) => setDraft({ ...draft, body: draft.body + (draft.body.endsWith("\n") || !draft.body ? "" : "\n") + snippet })} />}
            {preview ? (
              <div className="prose-notes min-h-64 rounded-lg border border-border-base bg-surface-2/50 px-4 py-3 text-[13px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.body) }} />
            ) : (
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={16}
                className="font-mono text-[13px] leading-relaxed"
                aria-label="Note content"
              />
            )}
            <div className="flex justify-end gap-2 mt-3">
              {dirty && <span className="text-xs text-muted self-center">Unsaved changes</span>}
              <Button variant="primary" size="sm" onClick={saveDraft} disabled={!dirty}>Save Note</Button>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<StickyNote size={28} />}
              title="Select a note to read or edit"
              hint="Notes support markdown: headings, checklists, code blocks, links and images."
              actions={<Button size="sm" variant="outline" onClick={createNote}>New Note</Button>}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

/** Cheat sheet for the note syntax, with one-click insertion of each pattern. */
function FormattingGuide({ onInsert }: { onInsert: (snippet: string) => void }) {
  const ROWS: { label: string; syntax: string; snippet: string; hint?: string }[] = [
    { label: "Heading", syntax: "# Big heading", snippet: "# Heading\n", hint: "## and ### for smaller" },
    { label: "Bold", syntax: "**important**", snippet: "**important** " },
    { label: "Italic", syntax: "*emphasis*", snippet: "*emphasis* " },
    { label: "Bullet list", syntax: "- point", snippet: "- First point\n- Second point\n" },
    { label: "Numbered list", syntax: "1. step", snippet: "1. First step\n2. Second step\n" },
    { label: "Checklist", syntax: "- [ ] to do", snippet: "- [ ] To do\n- [x] Done\n", hint: "[x] renders as ticked" },
    { label: "Quote", syntax: "> professor said…", snippet: "> Quote or key point\n" },
    { label: "Inline code", syntax: "`variable`", snippet: "`code` " },
    { label: "Code block", syntax: "``` … ```", snippet: "```\nyour code here\n```\n" },
    { label: "Link", syntax: "[text](https://…)", snippet: "[link text](https://example.com) " },
    { label: "Image", syntax: "![alt](https://…)", snippet: "![alt text](https://example.com/image.png)\n" },
  ];
  return (
    <div className="mb-2 rounded-lg border border-border-base bg-surface-2/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
        Formatting — click any row to insert it
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {ROWS.map((r) => (
          <button
            key={r.label}
            onClick={() => onInsert(r.snippet)}
            className="flex items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-surface-2"
            title={r.hint ?? `Insert ${r.label.toLowerCase()}`}
          >
            <span className="w-24 shrink-0 text-[11px] text-muted">{r.label}</span>
            <code className="font-mono text-[11px] text-foreground truncate">{r.syntax}</code>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-faint mt-2">
        Notes are searchable, and can be linked to a course, assignment or exam using the selectors above.
      </p>
    </div>
  );
}
