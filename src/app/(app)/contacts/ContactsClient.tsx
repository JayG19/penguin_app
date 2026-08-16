"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Copy, Mail, Phone, Plus, User } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Select, SourceBadge, toast } from "@/components/ui";
import type { ContactDTO, CourseDTO } from "@/components/types";
import { cn, courseColor } from "@/lib/utils";

export function ContactsClient({ contacts, courses }: { contacts: ContactDTO[]; courses: CourseDTO[] }) {
  const [q, setQ] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const filtered = useMemo(
    () =>
      contacts
        .filter((c) => !courseFilter || c.courseId === courseFilter)
        .filter((c) => !roleFilter || c.role === roleFilter)
        .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())),
    [contacts, q, courseFilter, roleFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Professors & TAs</h1>
          <p className="text-[13px] text-muted">{contacts.length} contacts across your courses</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "contact" } }))}>
          <Plus size={14} /> Add Contact
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="max-w-56" aria-label="Search contacts" />
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-auto" aria-label="Filter by course">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </Select>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-auto" aria-label="Filter by role">
          <option value="">All roles</option>
          <option value="professor">Professors</option>
          <option value="ta">TAs</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<User size={28} />}
            title="No contacts found"
            actions={
              <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent("quickadd", { detail: { type: "contact" } }))}>
                Add Contact
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted shrink-0">
                    <User size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium truncate">{c.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge tone={c.role === "professor" ? "accent" : "blue"}>{c.role === "ta" ? "TA" : "Professor"}</Badge>
                      {c.course && <Badge className={cn(courseColor(c.course.color).soft, courseColor(c.course.color).text)}>{c.course.code}</Badge>}
                    </div>
                  </div>
                </div>
                <SourceBadge source={c.source} />
              </div>
              <dl className="mt-3 space-y-1 text-[13px] min-h-16">
                {c.email && <div className="flex gap-2 min-w-0"><dt className="text-muted w-16 shrink-0">Email</dt><dd className="truncate">{c.email}</dd></div>}
                {c.office && <div className="flex gap-2"><dt className="text-muted w-16 shrink-0">Office</dt><dd>{c.office}</dd></div>}
                {c.officeHours && <div className="flex gap-2"><dt className="text-muted w-16 shrink-0">Hours</dt><dd>{c.officeHours}</dd></div>}
                {c.phone && <div className="flex gap-2"><dt className="text-muted w-16 shrink-0">Phone</dt><dd className="flex items-center gap-1"><Phone size={11} /> {c.phone}</dd></div>}
              </dl>
              <div className="flex gap-2 mt-3 flex-wrap">
                {c.email && (
                  <>
                    <a href={`mailto:${c.email}`}>
                      <Button size="xs" variant="secondary"><Mail size={12} /> Email</Button>
                    </a>
                    <Button size="xs" variant="outline" onClick={() => { navigator.clipboard.writeText(c.email!); toast("Email copied"); }}>
                      <Copy size={12} /> Copy Email
                    </Button>
                  </>
                )}
                {c.course && (
                  <Link href={`/courses/${c.course.id}`}>
                    <Button size="xs" variant="outline"><BookOpen size={12} /> View Course</Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
