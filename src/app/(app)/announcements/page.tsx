import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { AnnouncementDTO, CourseDTO } from "@/components/types";
import { AnnouncementsClient } from "./AnnouncementsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const user = (await getSessionUser())!;
  const [announcements, courses] = await Promise.all([
    db.announcement.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: { postedAt: "desc" },
    }),
    db.course.findMany({ where: { userId: user.id, archived: false }, orderBy: { code: "asc" } }),
  ]);
  return (
    <AnnouncementsClient
      announcements={serialize<AnnouncementDTO[]>(announcements)}
      courses={serialize<CourseDTO[]>(courses)}
    />
  );
}
