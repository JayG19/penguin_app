"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BellRing, ClipboardCheck, ClipboardList, Copy, ExternalLink, FileQuestion, FileText, Film,
  FolderOpen, Link2, Mail, Plus, RotateCcw, StickyNote, User, Video,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select, SourceBadge, toast } from "@/components/ui";
import { AssignmentDrawer } from "@/components/AssignmentDrawer";
import { QuizDrawer } from "@/components/QuizDrawer";
import type { AnnouncementDTO, AssignmentDTO, ContactDTO, GradeItemDTO, NoteDTO, QuizDTO } from "@/components/types";
import { projectedFinal, requiredOnRemaining, summarizeGrades } from "@/lib/grades";
import { cn, countdown, courseColor, fmtDate, relativeDue, timeAgo } from "@/lib/utils";

export interface CourseDetailData {
  id: string;
  code: string;
  name: string;
  term: string;
  description: string | null;
  color: string;
  officeHours: string | null;
  progress: number;
  brightspaceUrl: string | null;
  source: string;
  overriddenFields: string | null;
  contacts: ContactDTO[];
  modules: { id: string; title: string; order: number; source: string; items: { id: string; title: string; type: string; url: string | null; updatedAt: string; source: string }[] }[];
  assignments: AssignmentDTO[];
  quizzes: QuizDTO[];
  announcements: AnnouncementDTO[];
  gradeItems: GradeItemDTO[];
  notes: NoteDTO[];
  resources: { id: string; title: string; url: string; description: string | null; source: string }[];
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "content", label: "Content" },
  { id: "assignments", label: "Assignments" },
  { id: "quizzes", label: "Quizzes" },
  { id: "grades", label: "Grades" },
  { id: "announcements", label: "Announcements" },
  { id: "notes", label: "Notes" },
  { id: "resources", label: "Resources" },
  { id: "contacts", label: "Professor / TA" },
  { id: "submissions", label: "Dropbox" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CourseClient({ data }: { data: CourseDetailData }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") as TabId) ?? "overview";
  const [openA, setOpenA] = useState<AssignmentDTO | null>(null);
  const [openQ, setOpenQ] = useState<QuizDTO | null>(null);
  const cc = courseColor(data.color);

  const setTab = (t: TabId) => router.replace(`/courses/${data.id}${t === "overview" ? "" : `?tab=${t}`}`);
  const professor = data.contacts.find((c) => c.role === "professor");
  const summary = summarizeGrades(data.gradeItems);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("h-2.5 w-2.5 rounded-full", cc.dot)} aria-hidden />
            <h1 className="text-lg font-semibold tracking-tight">
              {data.code} — {data.name}
            </h1>
            <SourceBadge source={data.source} />
          </div>
          <p className="text-[13px] text-muted mt-0.5">
            {data.term}
            {professor ? ` · ${professor.name}` : ""}
            {summary.currentGrade != null ? ` · Current grade ${summary.currentGrade.toFixed(1)}%` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {professor?.email && (
            <a href={`mailto:${professor.email}`}>
              <Button size="sm" variant="outline"><Mail size={13} /> Email Professor</Button>
            </a>
          )}
          {data.brightspaceUrl && (
            <a href={data.brightspaceUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline"><ExternalLink size={13} /> Brightspace</Button>
            </a>
          )}
        </div>
      </div>

      <div className="border-b border-border-base -mx-1 overflow-x-auto">
        <div className="flex gap-1 px-1 min-w-max" role="tablist" aria-label="Course sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap",
                tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <Overview data={data} openAssignment={setOpenA} openQuiz={setOpenQ} />}
      {tab === "content" && <Content data={data} />}
      {tab === "assignments" && <Assignments data={data} open={setOpenA} />}
      {tab === "quizzes" && <Quizzes data={data} open={setOpenQ} />}
      {tab === "grades" && <Grades data={data} />}
      {tab === "announcements" && <Announcements data={data} />}
      {tab === "notes" && <Notes data={data} />}
      {tab === "resources" && <Resources data={data} />}
      {tab === "contacts" && <Contacts data={data} />}
      {tab === "submissions" && <Submissions data={data} open={setOpenA} />}

      <AssignmentDrawer assignment={openA} onClose={() => setOpenA(null)} />
      <QuizDrawer quiz={openQ} onClose={() => setOpenQ(null)} />
    </div>
  );
}

/* ---------- Overview ---------- */

function Overview({ data, openAssignment, openQuiz }: { data: CourseDetailData; openAssignment: (a: AssignmentDTO) => void; openQuiz: (q: QuizDTO) => void }) {
  const now = new Date();
  const upcoming = [
    ...data.assignments
      .filter((a) => a.dueAt && new Date(a.dueAt) > now && !["completed", "submitted"].includes(a.status))
      .map((a) => ({ at: new Date(a.dueAt!), label: a.title, weight: a.weight, open: () => openAssignment(a) })),
    ...data.quizzes
      .filter((q) => q.startAt && new Date(q.startAt) > now && q.status === "upcoming")
      .map((q) => ({ at: new Date(q.startAt!), label: q.title, weight: q.weight, open: () => openQuiz(q) })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 5);

  const professor = data.contacts.find((c) => c.role === "professor");
  const tas = data.contacts.filter((c) => c.role === "ta");
  const summary = summarizeGrades(data.gradeItems);
  const cc = courseColor(data.color);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div className="lg:col-span-2 space-y-4">
        {data.description && (
          <Card className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">About this course</h3>
            <p className="text-[13px] leading-relaxed">{data.description}</p>
          </Card>
        )}
        <Card>
          <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Upcoming deadlines</h3>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming deadlines" hint="You're all caught up in this course 🎉" />
          ) : (
            <div className="divide-y divide-border-base">
              {upcoming.map((u, i) => (
                <button key={i} onClick={u.open} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                  <span className="text-[13px] font-medium truncate grow">{u.label}</span>
                  {u.weight != null && u.weight > 0 && <span className="text-xs text-muted tabular-nums">{u.weight}%</span>}
                  <span className="text-xs text-muted shrink-0">{relativeDue(u.at.toISOString())}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div className="px-4 pt-3.5 pb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recent announcements</h3>
          </div>
          {data.announcements.length === 0 ? (
            <EmptyState title="No announcements yet" />
          ) : (
            <div className="divide-y divide-border-base">
              {data.announcements.slice(0, 3).map((a) => (
                <Link key={a.id} href={`/announcements?open=${a.id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", a.read ? "bg-border-strong" : "bg-accent")} />
                    <span className={cn("text-[13px] truncate", !a.read && "font-medium")}>{a.title}</span>
                    <span className="text-[11px] text-faint ml-auto shrink-0">{timeAgo(a.postedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Progress</h3>
          <ProgressBar value={data.progress * 100} barClassName={cc.bar} />
          <p className="text-xs text-muted mt-1.5">{Math.round(data.progress * 100)}% of graded work complete</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-lg bg-surface-2 p-2.5 text-center">
              <p className="text-base font-semibold tabular-nums">{summary.currentGrade != null ? `${summary.currentGrade.toFixed(1)}%` : "—"}</p>
              <p className="text-[10px] text-muted uppercase">Current grade</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2.5 text-center">
              <p className="text-base font-semibold tabular-nums">{summary.remainingWeight.toFixed(0)}%</p>
              <p className="text-[10px] text-muted uppercase">Weight left</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Teaching team</h3>
          {data.contacts.length === 0 && <p className="text-[13px] text-faint">No contacts yet.</p>}
          {professor && <ContactRow c={professor} />}
          {tas.map((t) => <ContactRow key={t.id} c={t} />)}
          {data.officeHours && <p className="text-xs text-muted mt-2">Office hours: {data.officeHours}</p>}
        </Card>
        {data.resources.length > 0 && (
          <Card className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Course links</h3>
            {data.resources.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-1 text-[13px] text-accent hover:underline">
                <Link2 size={13} /> {r.title}
              </a>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function ContactRow({ c }: { c: ContactDTO }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-muted shrink-0">
        <User size={13} />
      </span>
      <div className="min-w-0 grow">
        <p className="text-[13px] font-medium truncate">{c.name}</p>
        <p className="text-[11px] text-muted capitalize">{c.role === "ta" ? "TA" : c.role}{c.officeHours ? ` · ${c.officeHours}` : ""}</p>
      </div>
      {c.email && (
        <a href={`mailto:${c.email}`} className="text-muted hover:text-accent p-1" aria-label={`Email ${c.name}`}>
          <Mail size={14} />
        </a>
      )}
    </div>
  );
}

/* ---------- Content ---------- */

function Content({ data }: { data: CourseDetailData }) {
  const ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
    file: FileText, link: Link2, page: FileText, video: Film,
  };
  void Video;
  if (data.modules.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FolderOpen size={28} />}
          title="No content synced yet"
          hint="Course modules and files appear here after a Brightspace sync."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {data.modules.map((m) => (
        <Card key={m.id}>
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">{m.title}</h3>
            <SourceBadge source={m.source} />
          </div>
          <div className="divide-y divide-border-base">
            {m.items.map((item) => {
              const Icon = ICONS[item.type] ?? FileText;
              return (
                <a
                  key={item.id}
                  href={item.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-2"
                >
                  <Icon size={14} className="text-muted shrink-0" />
                  <span className="text-[13px] truncate grow">{item.title}</span>
                  <span className="text-[11px] text-faint capitalize shrink-0">{item.type}</span>
                </a>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Assignments / Quizzes ---------- */

function Assignments({ data, open }: { data: CourseDetailData; open: (a: AssignmentDTO) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "assignment", courseId: data.id } }))}>
          <Plus size={13} /> Add
        </Button>
      </div>
      {data.assignments.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList size={28} />} title="No assignments" hint="Add one manually or sync Brightspace." /></Card>
      ) : (
        data.assignments.map((a) => (
          <Card key={a.id} className="px-4 py-3 cursor-pointer hover:border-border-strong" onClick={() => open(a)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(a)}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 grow">
                <p className="text-[14px] font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted">{relativeDue(a.dueAt)}{a.weight != null ? ` · ${a.weight}%` : ""}</p>
              </div>
              <div className="w-20 hidden sm:block"><ProgressBar value={a.completionPct} /></div>
              <Badge tone={["completed", "submitted"].includes(a.status) ? "green" : a.status === "in_progress" ? "blue" : "neutral"}>
                {a.status.replace("_", " ")}
              </Badge>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function Quizzes({ data, open }: { data: CourseDetailData; open: (q: QuizDTO) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "exam", courseId: data.id } }))}>
          <Plus size={13} /> Add
        </Button>
      </div>
      {data.quizzes.length === 0 ? (
        <Card><EmptyState icon={<FileQuestion size={28} />} title="No quizzes or exams" /></Card>
      ) : (
        data.quizzes.map((q) => {
          const cd = q.startAt ? countdown(q.startAt) : null;
          return (
            <Card key={q.id} className="px-4 py-3 cursor-pointer hover:border-border-strong" onClick={() => open(q)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(q)}>
              <div className="flex items-center gap-3">
                <Badge tone={["midterm", "final"].includes(q.kind) ? "red" : "violet"} className="capitalize">{q.kind}</Badge>
                <div className="min-w-0 grow">
                  <p className="text-[14px] font-medium truncate">{q.title}</p>
                  <p className="text-xs text-muted">{q.startAt ? fmtDate(q.startAt, true) : "Date TBD"}{q.location ? ` · ${q.location}` : ""}</p>
                </div>
                {q.weight != null && q.weight > 0 && <span className="text-sm font-semibold tabular-nums">{q.weight}%</span>}
                {cd && <span className="text-xs text-muted tabular-nums hidden sm:inline">{cd}</span>}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ---------- Grades ---------- */

function Grades({ data }: { data: CourseDetailData }) {
  const router = useRouter();
  const [items, setItems] = useState(data.gradeItems);
  const [target, setTarget] = useState(85);
  const summary = summarizeGrades(items);
  const required = requiredOnRemaining(summary, target);

  async function updateScore(g: GradeItemDTO, raw: string) {
    const score = raw === "" ? null : Number(raw);
    if (score != null && (isNaN(score) || score < 0)) return;
    const res = await fetch(`/api/grades/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
    if (res.ok) {
      const updated = (await res.json()).grade;
      setItems((prev) => prev.map((x) => (x.id === g.id ? updated : x)));
      router.refresh();
    }
  }

  async function restore(g: GradeItemDTO) {
    const res = await fetch(`/api/grades/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: ["score"] }),
    });
    if (res.ok) {
      const updated = (await res.json()).grade;
      setItems((prev) => prev.map((x) => (x.id === g.id ? updated : x)));
      toast("Restored Brightspace value");
      router.refresh();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <Card className="lg:col-span-2 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border-base">
              <th className="px-4 py-2.5 font-semibold">Item</th>
              <th className="px-2 py-2.5 font-semibold">Category</th>
              <th className="px-2 py-2.5 font-semibold text-right">Weight</th>
              <th className="px-2 py-2.5 font-semibold text-right">Score</th>
              <th className="px-4 py-2.5 font-semibold text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => {
              const overridden = g.overriddenFields?.includes("score");
              return (
                <tr key={g.id} className="border-b border-border-base last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-medium">{g.name}</span>
                    {overridden && (
                      <button onClick={() => restore(g)} className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5 hover:underline" title="You edited this grade; click to restore the Brightspace value">
                        Overridden <RotateCcw size={9} />
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-muted capitalize">{g.category}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{g.weight}%</td>
                  <td className="px-2 py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Input
                        type="number"
                        defaultValue={g.score ?? ""}
                        onBlur={(e) => e.target.value !== String(g.score ?? "") && updateScore(g, e.target.value)}
                        className="w-16 h-7 text-right text-xs px-1.5"
                        aria-label={`Score for ${g.name}`}
                      />
                      <span className="text-muted text-xs">/ {g.maxScore}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {g.score != null ? `${((g.score / g.maxScore) * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={5}><EmptyState title="No grade items" hint="Add grade categories to plan your grade." /></td></tr>
            )}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-border-base">
          <AddGradeItem courseId={data.id} onAdded={(g) => setItems((prev) => [...prev, g])} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">Grade calculator</h3>
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Current grade</span><span className="font-semibold tabular-nums">{summary.currentGrade != null ? `${summary.currentGrade.toFixed(1)}%` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted">Weighted (banked)</span><span className="font-semibold tabular-nums">{summary.earnedWeighted.toFixed(1)}%</span></div>
          <div className="flex justify-between"><span className="text-muted">Remaining weight</span><span className="font-semibold tabular-nums">{summary.remainingWeight.toFixed(0)}%</span></div>
          {summary.currentGrade != null && (
            <div className="flex justify-between"><span className="text-muted">On pace for</span><span className="font-semibold tabular-nums">{projectedFinal(summary, summary.currentGrade).toFixed(1)}%</span></div>
          )}
        </div>
        <div className="mt-4">
          <label htmlFor="target" className="flex justify-between text-[13px] mb-1">
            <span className="text-muted">Target final grade</span>
            <span className="font-semibold tabular-nums">{target}%</span>
          </label>
          <input id="target" type="range" min={50} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          <p className="text-[13px] mt-2">
            {required == null ? (
              <span className="text-muted">All weight is graded.</span>
            ) : required > 100 ? (
              <span className="text-rose-600 dark:text-rose-400">You&apos;d need {required.toFixed(1)}% on remaining work — not reachable.</span>
            ) : required <= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">Already secured 🎉</span>
            ) : (
              <>Required on remaining: <span className="font-semibold tabular-nums">{required.toFixed(1)}%</span></>
            )}
          </p>
        </div>
      </Card>
    </div>
  );
}

function AddGradeItem({ courseId, onAdded }: { courseId: string; onAdded: (g: GradeItemDTO) => void }) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [category, setCategory] = useState("assignment");

  async function add() {
    if (!name.trim() || !weight) return;
    const res = await fetch("/api/grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, name, weight: Number(weight), category }),
    });
    if (res.ok) {
      const g = (await res.json()).grade;
      onAdded(g);
      setName(""); setWeight("");
      toast("Grade item added");
    }
  }

  return (
    <form className="flex gap-2 flex-wrap items-center" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New grade item…" className="w-44 h-8 text-xs" aria-label="Grade item name" />
      <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto h-8 text-xs" aria-label="Category">
        {["assignment", "quiz", "midterm", "final", "participation", "project", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" min={0} max={100} placeholder="Weight %" className="w-24 h-8 text-xs" aria-label="Weight" />
      <Button type="submit" size="xs" variant="secondary"><Plus size={12} /> Add</Button>
    </form>
  );
}

/* ---------- Announcements ---------- */

function Announcements({ data }: { data: CourseDetailData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {data.announcements.length === 0 && <Card><EmptyState icon={<BellRing size={28} />} title="No announcements" /></Card>}
      {data.announcements.map((a) => (
        <Card key={a.id} className="px-4 py-3">
          <button
            className="flex w-full items-start gap-2.5 text-left"
            onClick={async () => {
              setExpanded(expanded === a.id ? null : a.id);
              if (!a.read) {
                await fetch(`/api/announcements/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) });
                router.refresh();
              }
            }}
          >
            <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", a.read ? "bg-border-strong" : "bg-accent")} />
            <span className="min-w-0 grow">
              <span className={cn("block text-[14px]", !a.read && "font-medium")}>{a.title}</span>
              <span className="block text-xs text-muted">{a.author ?? "—"} · {timeAgo(a.postedAt)}</span>
            </span>
            <SourceBadge source={a.source} />
          </button>
          {expanded === a.id && <p className="text-[13px] leading-relaxed mt-2.5 ml-[18px] whitespace-pre-wrap">{a.body}</p>}
        </Card>
      ))}
    </div>
  );
}

/* ---------- Notes ---------- */

function Notes({ data }: { data: CourseDetailData }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "note", courseId: data.id } }))}>
          <Plus size={13} /> New Note
        </Button>
      </div>
      {data.notes.length === 0 ? (
        <Card><EmptyState icon={<StickyNote size={28} />} title="No notes for this course" hint="Capture lecture notes, questions and study plans." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.notes.map((n) => (
            <Link key={n.id} href={`/notes?open=${n.id}`}>
              <Card className="p-3.5 h-full hover:border-border-strong">
                <p className="text-[14px] font-medium truncate">{n.title}</p>
                <p className="text-xs text-muted line-clamp-3 mt-1 whitespace-pre-wrap">{n.body.slice(0, 160)}</p>
                <p className="text-[11px] text-faint mt-2">{timeAgo(n.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Resources ---------- */

function Resources({ data }: { data: CourseDetailData }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "resource", courseId: data.id } }))}>
          <Plus size={13} /> Add Resource
        </Button>
      </div>
      {data.resources.length === 0 ? (
        <Card><EmptyState icon={<Link2 size={28} />} title="No resources" hint="Save useful links for this course." /></Card>
      ) : (
        data.resources.map((r) => (
          <Card key={r.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Link2 size={15} className="text-muted shrink-0" />
              <div className="min-w-0 grow">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-accent hover:underline">{r.title}</a>
                {r.description && <p className="text-xs text-muted truncate">{r.description}</p>}
              </div>
              <SourceBadge source={r.source} />
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

/* ---------- Contacts ---------- */

function Contacts({ data }: { data: CourseDetailData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.contacts.length === 0 && (
        <Card className="sm:col-span-2"><EmptyState icon={<User size={28} />} title="No contacts" hint="Add your professor and TAs." actions={<Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "contact", courseId: data.id } }))}>Add Contact</Button>} /></Card>
      )}
      {data.contacts.map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted"><User size={16} /></span>
              <div>
                <p className="text-[14px] font-medium">{c.name}</p>
                <p className="text-xs text-muted capitalize">{c.role === "ta" ? "Teaching Assistant" : "Professor"}</p>
              </div>
            </div>
            <SourceBadge source={c.source} />
          </div>
          <dl className="mt-3 space-y-1 text-[13px]">
            {c.email && <div className="flex gap-2"><dt className="text-muted w-20">Email</dt><dd className="truncate">{c.email}</dd></div>}
            {c.office && <div className="flex gap-2"><dt className="text-muted w-20">Office</dt><dd>{c.office}</dd></div>}
            {c.officeHours && <div className="flex gap-2"><dt className="text-muted w-20">Hours</dt><dd>{c.officeHours}</dd></div>}
            {c.phone && <div className="flex gap-2"><dt className="text-muted w-20">Phone</dt><dd>{c.phone}</dd></div>}
          </dl>
          {c.email && (
            <div className="flex gap-2 mt-3">
              <a href={`mailto:${c.email}`}><Button size="xs" variant="secondary"><Mail size={12} /> Email</Button></a>
              <Button size="xs" variant="outline" onClick={() => { navigator.clipboard.writeText(c.email!); toast("Email copied"); }}>
                <Copy size={12} /> Copy Email
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ---------- Submissions ---------- */

function Submissions({ data, open }: { data: CourseDetailData; open: (a: AssignmentDTO) => void }) {
  const STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
    not_submitted: "neutral", submitted: "green", late: "amber", graded: "blue", returned: "violet" as never,
  };
  return (
    <div className="space-y-2">
      {data.assignments.length === 0 && <Card><EmptyState icon={<ClipboardCheck size={28} />} title="No dropbox folders" /></Card>}
      {data.assignments.map((a) => {
        const sub = a.submission;
        const status = sub?.status ?? "not_submitted";
        return (
          <Card key={a.id} className="px-4 py-3 cursor-pointer hover:border-border-strong" onClick={() => open(a)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(a)}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-0 grow">
                <p className="text-[14px] font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted">
                  Due {a.dueAt ? fmtDate(a.dueAt, true) : "—"}
                  {sub?.submittedAt ? ` · submitted ${fmtDate(sub.submittedAt, true)}` : ""}
                </p>
              </div>
              {sub?.grade && <span className="text-sm font-semibold tabular-nums">{sub.grade}</span>}
              <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace("_", " ")}</Badge>
              {a.brightspaceUrl && (
                <a href={a.brightspaceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted hover:text-accent" aria-label="Open in Brightspace">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            {sub?.feedback && <p className="text-xs text-muted italic mt-1.5">&ldquo;{sub.feedback}&rdquo;</p>}
          </Card>
        );
      })}
    </div>
  );
}
