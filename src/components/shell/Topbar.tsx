"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Check, ChevronDown, LogOut, Moon, Search, Sun, Monitor, GraduationCap } from "lucide-react";
import { Menu, MenuItem, toast } from "@/components/ui";
import { cn, courseColor, timeAgo } from "@/lib/utils";
import { applyAppearance } from "@/lib/appearance";

interface CourseLite {
  id: string;
  code: string;
  name: string;
  color: string;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

export function Topbar({ userName, email, courses }: { userName: string; email: string; courses: CourseLite[] }) {
  const router = useRouter();
  const [theme, setTheme] = useState<string>("system");
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setTheme(localStorage.getItem("campushub-theme") ?? "system");
    refreshNotifs();
    const t = setInterval(refreshNotifs, 60_000);
    return () => clearInterval(t);
  }, []);

  async function refreshNotifs() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications);
      setUnread(data.unread);
    } catch {}
  }

  function applyTheme(next: string) {
    setTheme(next);
    applyAppearance({ theme: next });
    try {
      localStorage.setItem("campushub-theme", next);
      const raw = localStorage.getItem("campushub-appearance");
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem("campushub-appearance", JSON.stringify({ ...parsed, theme: next }));
    } catch {}
    fetch("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: next }) }).catch(() => {});
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    refreshNotifs();
  }

  function notifHref(n: NotificationRow): string {
    switch (n.entityType) {
      case "assignment": return `/assignments?open=${n.entityId}`;
      case "quiz": return `/quizzes?open=${n.entityId}`;
      case "announcement": return `/announcements?open=${n.entityId}`;
      case "course": return `/courses/${n.entityId}`;
      default: return "/dashboard";
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border-base bg-background/85 backdrop-blur px-3 sm:px-5">
      <Link href="/dashboard" className="lg:hidden flex items-center gap-2 mr-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white dark:text-zinc-900">
          <GraduationCap size={15} />
        </span>
      </Link>

      {/* Course quick switcher */}
      <Menu
        align="left"
        trigger={
          <button className="flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-[13px] font-medium text-muted hover:text-foreground hover:bg-surface-2 border border-transparent hover:border-border-base">
            Courses <ChevronDown size={14} />
          </button>
        }
      >
        {courses.map((c) => (
          <MenuItem key={c.id} onClick={() => router.push(`/courses/${c.id}`)}>
            <span className={cn("h-2 w-2 rounded-full shrink-0", courseColor(c.color).dot)} />
            <span className="font-medium">{c.code}</span>
            <span className="text-muted truncate">{c.name}</span>
          </MenuItem>
        ))}
        <MenuItem onClick={() => router.push("/courses")}>
          <span className="text-muted">View all courses…</span>
        </MenuItem>
      </Menu>

      <div className="grow" />

      {/* Search trigger */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("palette:open"))}
        className="flex items-center gap-2 rounded-lg border border-border-base bg-surface px-3 h-8.5 text-[13px] text-muted hover:border-border-strong w-40 sm:w-64"
        aria-label="Open search (Ctrl+K)"
      >
        <Search size={14} />
        <span className="grow text-left hidden sm:inline">Search anything…</span>
        <kbd className="hidden sm:inline text-[10px] font-mono border border-border-base rounded px-1 py-px bg-surface-2">⌘K</kbd>
      </button>

      {/* Notifications */}
      <Menu
        trigger={
          <button className="relative p-2 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
            <Bell size={17} />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />}
          </button>
        }
      >
        <div className="w-80 max-w-[85vw]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-base">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:underline flex items-center gap-1">
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 && <p className="text-[13px] text-muted px-3 py-6 text-center">You&apos;re all caught up 🎉</p>}
            {notifs.map((n) => (
              <MenuItem key={n.id} onClick={() => {
                fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).then(refreshNotifs);
                router.push(notifHref(n));
              }}>
                <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", n.read ? "bg-border-strong" : "bg-accent")} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium truncate">{n.title}</span>
                  {n.body && <span className="block text-xs text-muted truncate">{n.body}</span>}
                  <span className="block text-[11px] text-faint">{timeAgo(n.createdAt)}</span>
                </span>
              </MenuItem>
            ))}
          </div>
        </div>
      </Menu>

      {/* Theme */}
      <Menu
        trigger={
          <button className="p-2 rounded-lg hover:bg-surface-2 text-muted hover:text-foreground" aria-label="Theme">
            <ThemeIcon size={17} />
          </button>
        }
      >
        {(["light", "dark", "system"] as const).map((t) => (
          <MenuItem key={t} onClick={() => applyTheme(t)}>
            {t === "light" ? <Sun size={14} /> : t === "dark" ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="capitalize">{t}</span>
            {theme === t && <Check size={13} className="ml-auto text-accent" />}
          </MenuItem>
        ))}
      </Menu>

      {/* User */}
      <Menu
        trigger={
          <button className="flex items-center gap-2 rounded-lg pl-1.5 pr-2 h-8.5 hover:bg-surface-2" aria-label="Account menu">
            <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-accent-soft text-accent text-xs font-semibold">
              {userName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
          </button>
        }
      >
        <div className="px-3 py-2 border-b border-border-base">
          <p className="text-[13px] font-medium">{userName}</p>
          <p className="text-xs text-muted truncate">{email}</p>
        </div>
        <MenuItem onClick={() => router.push("/settings")}>Settings</MenuItem>
        <MenuItem onClick={() => { toast("Signed out"); logout(); }} danger>
          <LogOut size={14} /> Sign out
        </MenuItem>
      </Menu>
    </header>
  );
}
