import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar, MobileNav } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { QuickAdd } from "@/components/shell/QuickAdd";
import { FocusProvider } from "@/components/focus/FocusProvider";
import { NudgeProvider } from "@/components/nudges/NudgeProvider";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import { Toaster } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const preference = await db.userPreference.findUnique({ where: { userId: user.id } });
  const [courses, unreadAnnouncements] = await Promise.all([
    db.course.findMany({
      where: { userId: user.id, archived: false },
      select: { id: true, code: true, name: true, color: true },
      orderBy: { code: "asc" },
    }),
    db.announcement.count({ where: { course: { userId: user.id } }, }),
  ]);
  const unread = await db.announcement.count({ where: { course: { userId: user.id }, read: false } });
  void unreadAnnouncements;

  const appearance = {
    theme: preference?.theme ?? "system",
    accent: preference?.accent ?? "indigo",
    background: preference?.background ?? "plain",
    backgroundUrl: preference?.backgroundUrl ?? null,
    priorityScheme: preference?.priorityScheme ?? "classic",
    density: preference?.density ?? "comfortable",
  };

  return (
    <FocusProvider>
      <NudgeProvider>
      <AppearanceProvider appearance={appearance} />
      <div className="flex min-h-dvh">
        <Sidebar unreadAnnouncements={unread} />
        <div className="flex min-w-0 grow flex-col">
          <Topbar userName={user.name} courses={courses} />
          <main className="grow px-3 sm:px-5 lg:px-7 py-4 sm:py-6 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
      <MobileNav unreadAnnouncements={unread} />
      <QuickAdd />
      <CommandPalette />
      <Toaster />
      </NudgeProvider>
    </FocusProvider>
  );
}
