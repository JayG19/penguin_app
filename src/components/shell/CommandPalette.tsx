"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing, BookOpen, Calendar, ClipboardList, Contact, FileQuestion, LayoutDashboard,
  Plus, RefreshCw, Search, Settings, StickyNote, Timer, Wrench, ArrowUpRight,
} from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  run: () => void;
  keywords?: string;
}

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  course: BookOpen, assignment: ClipboardList, quiz: FileQuestion, note: StickyNote,
  announcement: BellRing, contact: Contact, resource: ArrowUpRight, task: ClipboardList, event: Calendar,
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("palette:open", onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  // Debounced entity search
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        }
      } catch {}
    }, 160);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      close();
      if (href.startsWith("http")) window.open(href, "_blank", "noopener");
      else router.push(href);
    },
    [router, close],
  );

  const actions: PaletteItem[] = useMemo(
    () => [
      { id: "nav-dashboard", label: "Go to Dashboard", icon: LayoutDashboard, run: () => go("/dashboard") },
      { id: "nav-courses", label: "Go to Courses", icon: BookOpen, run: () => go("/courses") },
      { id: "nav-assignments", label: "Go to Assignments", icon: ClipboardList, run: () => go("/assignments") },
      { id: "nav-quizzes", label: "Go to Quizzes & Exams", icon: FileQuestion, run: () => go("/quizzes") },
      { id: "nav-calendar", label: "Open Calendar", icon: Calendar, run: () => go("/calendar") },
      { id: "nav-grades", label: "Open Grades", icon: BookOpen, keywords: "grade calculator gpa", run: () => go("/courses") },
      { id: "nav-announcements", label: "Go to Announcements", icon: BellRing, run: () => go("/announcements") },
      { id: "nav-notes", label: "Go to Notes", icon: StickyNote, run: () => go("/notes") },
      { id: "nav-tools", label: "Open Useful Tools", icon: Wrench, run: () => go("/tools") },
      { id: "nav-settings", label: "Open Settings", icon: Settings, run: () => go("/settings") },
      {
        id: "sync", label: "Sync Brightspace", icon: RefreshCw, keywords: "refresh import",
        run: async () => {
          close();
          toast("Syncing with Brightspace…");
          const res = await fetch("/api/sync", { method: "POST" });
          if (res.ok) {
            const r = await res.json();
            toast(r.status === "success" ? `Sync complete: +${r.added} added, ${r.updated} updated` : "Sync failed", r.status === "success" ? "default" : "error");
            router.refresh();
          }
        },
      },
      {
        id: "create-assignment", label: "Create Assignment", icon: Plus, keywords: "new add",
        run: () => { close(); window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "assignment" } })); },
      },
      {
        id: "create-note", label: "Create Note", icon: Plus, keywords: "new add",
        run: () => { close(); window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "note" } })); },
      },
      {
        id: "create-task", label: "Create Task", icon: Plus, keywords: "new add todo reminder",
        run: () => { close(); window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "task" } })); },
      },
      {
        id: "focus", label: "Start Focus Session", icon: Timer, keywords: "pomodoro study timer",
        run: () => { close(); window.dispatchEvent(new CustomEvent("focus:start", { detail: { label: "Focus session", minutes: 25 } })); },
      },
      { id: "open-docs", label: "Open Google Docs", icon: ArrowUpRight, keywords: "tool", run: () => go("https://docs.google.com") },
      { id: "open-figma", label: "Open Figma", icon: ArrowUpRight, keywords: "tool", run: () => go("https://figma.com") },
    ],
    [go, close, router],
  );

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions.slice(0, 8);
    return actions.filter((a) => `${a.label} ${a.keywords ?? ""}`.toLowerCase().includes(q));
  }, [actions, query]);

  const rows: { kind: "action" | "result"; action?: PaletteItem; result?: SearchResult }[] = useMemo(
    () => [
      ...results.map((r) => ({ kind: "result" as const, result: r })),
      ...filteredActions.map((a) => ({ kind: "action" as const, action: a })),
    ],
    [results, filteredActions],
  );

  useEffect(() => setActive(0), [rows.length, query]);

  function runRow(row: (typeof rows)[number]) {
    if (row.kind === "action" && row.action) row.action.run();
    else if (row.result) go(row.result.href);
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={close} aria-hidden />
      <div className="absolute left-1/2 top-[12vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-border-base bg-surface shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="flex items-center gap-2.5 border-b border-border-base px-4">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && rows[active]) { e.preventDefault(); runRow(rows[active]); }
            }}
            placeholder="Search courses, assignments, notes — or type a command…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-faint"
            aria-label="Search"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1.5">
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-muted">No matches. Try a different search.</p>
          )}
          {results.length > 0 && <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Results</p>}
          {rows.map((row, i) => {
            const Icon = row.kind === "action" ? row.action!.icon : TYPE_ICON[row.result!.type] ?? Search;
            const label = row.kind === "action" ? row.action!.label : row.result!.title;
            const hint = row.kind === "action" ? row.action!.hint : row.result!.subtitle ?? row.result!.type;
            return (
              <div key={row.kind === "action" ? row.action!.id : `${row.result!.type}-${row.result!.id}`}>
                {row.kind === "action" && i === results.length && (
                  <p className="px-4 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Commands</p>
                )}
                <button
                  onClick={() => runRow(row)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-left",
                    i === active ? "bg-accent-soft text-foreground" : "text-foreground",
                  )}
                >
                  <Icon size={15} className="text-muted shrink-0" />
                  <span className="grow truncate">{label}</span>
                  {hint && <span className="text-[11px] text-faint capitalize shrink-0">{hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
