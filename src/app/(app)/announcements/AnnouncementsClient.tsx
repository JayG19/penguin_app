"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, ExternalLink, MailOpen } from "lucide-react";
import { Badge, Button, Card, Checkbox, EmptyState, Segmented, Select, SourceBadge, toast } from "@/components/ui";
import type { AnnouncementDTO, CourseDTO } from "@/components/types";
import { cn, courseColor, timeAgo } from "@/lib/utils";

export function AnnouncementsClient({ announcements, courses }: { announcements: AnnouncementDTO[]; courses: CourseDTO[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [courseFilter, setCourseFilter] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const openId = params.get("open");
    if (openId && announcements.some((a) => a.id === openId)) {
      setExpanded(openId);
      const a = announcements.find((x) => x.id === openId)!;
      if (!a.read) markRead(a.id, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(
    () =>
      announcements
        .filter((a) => !courseFilter || a.courseId === courseFilter)
        .filter((a) => readFilter === "all" || !a.read)
        .sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1)),
    [announcements, courseFilter, readFilter],
  );

  async function markRead(id: string, read: boolean) {
    await fetch(`/api/announcements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read }) });
    router.refresh();
  }

  async function markAllRead() {
    await fetch("/api/announcements", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(courseFilter ? { courseId: courseFilter } : {}) });
    router.refresh();
  }

  function toggleOne(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(filtered.map((a) => a.id)) : new Set());
  }

  /** Applies read/unread to every checked row, then clears the selection. */
  async function markSelected(read: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/announcements/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read }),
        }),
      ),
    );
    toast(`${ids.length} marked as ${read ? "read" : "unread"}`);
    setSelected(new Set());
    router.refresh();
  }

  const unreadCount = announcements.filter((a) => !a.read).length;
  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Announcements</h1>
          <p className="text-[13px] text-muted">{unreadCount} unread of {announcements.length}</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            <Check size={13} /> Mark all as read
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Segmented options={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }]} value={readFilter} onChange={setReadFilter} />
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-auto" aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
        {filtered.length > 0 && (
          <label className="ml-1 flex items-center gap-2 text-[13px] text-muted cursor-pointer select-none">
            <Checkbox
              checked={allSelected}
              indeterminate={selected.size > 0 && !allSelected}
              onChange={toggleAll}
              label="Select all announcements"
            />
            Select all
          </label>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 flex-wrap">
          <span className="text-[13px] font-medium text-accent">{selected.size} selected</span>
          <span className="grow" />
          <Button size="xs" variant="primary" onClick={() => markSelected(true)}>
            <Check size={12} /> Mark as read
          </Button>
          <Button size="xs" variant="outline" onClick={() => markSelected(false)}>
            <MailOpen size={12} /> Mark as unread
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellRing size={28} />}
            title={readFilter === "unread" ? "No unread announcements" : "No announcements"}
            hint="You're all caught up 🎉"
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className={cn("px-4 py-3", !a.read && "border-l-2 border-l-accent")}>
              <div className="flex items-start gap-3">
              <span className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(a.id)}
                  onChange={(on) => toggleOne(a.id, on)}
                  label={`Select ${a.title}`}
                />
              </span>
              <button
                className="flex w-full items-start gap-3 text-left"
                onClick={() => {
                  setExpanded(expanded === a.id ? null : a.id);
                  if (!a.read) markRead(a.id, true);
                }}
                aria-expanded={expanded === a.id}
              >
                <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", a.read ? "bg-border-strong" : "bg-accent")} />
                <span className="min-w-0 grow">
                  <span className="flex items-center gap-2 flex-wrap">
                    <Badge tone="none" className={cn(courseColor(a.course.color).soft, courseColor(a.course.color).text)}>{a.course.code}</Badge>
                    <span className="text-[11px] text-faint">{timeAgo(a.postedAt)}</span>
                    <SourceBadge source={a.source} />
                  </span>
                  <span className={cn("block text-[14px] mt-1", !a.read && "font-medium")}>{a.title}</span>
                  {a.author && <span className="block text-xs text-muted mt-0.5">{a.author}</span>}
                </span>
              </button>
              </div>
              {expanded === a.id && (
                <div className="ml-5 mt-2.5 pt-2.5 border-t border-border-base">
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{a.body}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="xs" variant="outline" onClick={() => markRead(a.id, !a.read)}>
                      Mark {a.read ? "unread" : "read"}
                    </Button>
                    {a.brightspaceUrl && (
                      <a href={a.brightspaceUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="xs" variant="outline"><ExternalLink size={11} /> Open Brightspace</Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
