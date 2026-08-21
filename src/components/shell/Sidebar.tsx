"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  BookOpen,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Contact,
  FileQuestion,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  RefreshCw,
  Settings,
  StickyNote,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/quizzes", label: "Quizzes & Exams", icon: FileQuestion },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/announcements", label: "Announcements", icon: BellRing },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/submissions", label: "Submissions", icon: ClipboardCheck },
  { href: "/contacts", label: "Professors & TAs", icon: Contact },
  { href: "/tools", label: "Useful Tools", icon: Wrench },
];

const FOOTER_NAV = [
  { href: "/sync", label: "Brightspace", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ unreadAnnouncements }: { unreadAnnouncements: number }) {
  const pathname = usePathname();

  const item = (n: { href: string; label: string; icon: typeof Inbox }) => {
    const active = pathname === n.href || pathname.startsWith(n.href + "/");
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className="app-sidebar-link flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors"
      >
        <n.icon size={16} strokeWidth={2} />
        <span className="grow">{n.label}</span>
        {n.href === "/announcements" && unreadAnnouncements > 0 && (
          <span className="rounded-full bg-[var(--accent-light)] text-white text-[10px] font-semibold px-1.5 py-px min-w-[18px] text-center">
            {unreadAnnouncements}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="app-sidebar hidden lg:flex w-56 shrink-0 flex-col h-dvh sticky top-0">
      <Link href="/dashboard" className="flex items-center gap-2 px-4 h-14 border-b border-white/10">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-light)] text-white">
          <GraduationCap size={16} />
        </span>
        <span className="font-semibold tracking-tight text-[15px] text-white">CampusHub</span>
      </Link>
      <nav className="flex flex-col gap-0.5 p-2.5 grow overflow-y-auto" aria-label="Main navigation">
        {NAV.map(item)}
      </nav>
      <div className="p-2.5 border-t border-white/10 flex flex-col gap-0.5">{FOOTER_NAV.map(item)}</div>
    </aside>
  );
}

export function MobileNav({ unreadAnnouncements }: { unreadAnnouncements: number }) {
  const pathname = usePathname();
  const primary = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5]];
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border-base bg-surface/95 backdrop-blur flex justify-around pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      {primary.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] font-medium",
              active ? "text-accent" : "text-muted",
            )}
          >
            <n.icon size={18} />
            {n.label.split(" ")[0]}
            {n.href === "/announcements" && unreadAnnouncements > 0 && (
              <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-accent" aria-label={`${unreadAnnouncements} unread`} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
