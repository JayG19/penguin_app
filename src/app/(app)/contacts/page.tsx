import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { ContactDTO, CourseDTO } from "@/components/types";
import { ContactsClient } from "./ContactsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Professors & TAs" };

export default async function ContactsPage() {
  const user = (await getSessionUser())!;
  const [contacts, courses] = await Promise.all([
    db.contact.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true, name: true, color: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.course.findMany({ where: { userId: user.id, archived: false }, orderBy: { code: "asc" } }),
  ]);
  return <ContactsClient contacts={serialize<ContactDTO[]>(contacts)} courses={serialize<CourseDTO[]>(courses)} />;
}
