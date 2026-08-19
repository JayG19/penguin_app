import { db } from "./db";

function at(daysFromNow: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Adds the hand-authored half of the demo dataset — class schedule, personal
 * tasks/events, notes, study history, a manual exam — on top of courses that
 * were already imported (via runSync against the mock Brightspace service).
 * Shared by the dev seed script and scripts/seed-sample-data.ts so both stay
 * in sync with one source of realistic content.
 */
export async function addDemoManualContent(userId: string) {
  const courses = await db.course.findMany({ where: { userId } });
  const byCode = Object.fromEntries(courses.map((c) => [c.code, c]));

  const schedule: { code: string; day: number; hour: number; minute: number; durationMins: number; location: string }[] = [
    { code: "ADM2302", day: 1, hour: 9, minute: 0, durationMins: 80, location: "DMS 1160" },
    { code: "ADM2302", day: 3, hour: 9, minute: 0, durationMins: 80, location: "DMS 1160" },
    { code: "ADM1305", day: 1, hour: 13, minute: 0, durationMins: 80, location: "STM 117" },
    { code: "ADM1305", day: 4, hour: 13, minute: 0, durationMins: 80, location: "STM 117" },
    { code: "MGT1100", day: 2, hour: 11, minute: 30, durationMins: 170, location: "DMS 4101" },
    { code: "ITI1120", day: 2, hour: 16, minute: 0, durationMins: 80, location: "SITE 0131" },
    { code: "ITI1120", day: 5, hour: 14, minute: 30, durationMins: 80, location: "SITE 0131" },
  ];
  const today = new Date();
  for (let offset = -3; offset < 21; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + offset);
    for (const s of schedule) {
      if (day.getDay() !== s.day) continue;
      const course = byCode[s.code];
      if (!course) continue;
      const start = new Date(day);
      start.setHours(s.hour, s.minute, 0, 0);
      const end = new Date(start.getTime() + s.durationMins * 60000);
      await db.calendarEvent.create({
        data: {
          userId, courseId: course.id, title: `${s.code} Lecture`, type: "class",
          startAt: start, endAt: end, location: s.location, source: "manual",
        },
      });
    }
  }

  await db.task.createMany({
    data: [
      { userId, courseId: byCode["ADM2302"]?.id, title: "Review Solver sensitivity report before midterm", kind: "study", dueAt: at(4, 18) },
      { userId, courseId: byCode["ITI1120"]?.id, title: "Finish practice questions for Quiz 1", kind: "study", dueAt: at(1, 20) },
      { userId, courseId: byCode["MGT1100"]?.id, title: "Book group meeting room for presentation prep", kind: "reminder", dueAt: at(2, 12) },
      { userId, title: "Renew U-Pass at the card office", kind: "reminder", dueAt: at(5, 15) },
      { userId, courseId: byCode["ADM1305"]?.id, title: "Chapter 3 reading — matrix applications", kind: "reading", dueAt: at(3, 21), completed: false },
      { userId, title: "Submit co-op application", kind: "task", dueAt: at(9, 17) },
    ],
  });

  await db.calendarEvent.createMany({
    data: [
      { userId, title: "Gym", type: "personal", startAt: at(1, 7, 30), endAt: at(1, 8, 30), source: "manual" },
      { userId, title: "Study group — ADM2302 midterm", type: "personal", courseId: byCode["ADM2302"]?.id, startAt: at(4, 16), endAt: at(4, 18), location: "Library room 3B", source: "manual" },
      { userId, title: "Co-op info session", type: "event", startAt: at(6, 12), endAt: at(6, 13), location: "CRX C240", source: "manual" },
    ],
  });

  const notes = [
    {
      title: "LP formulation checklist", courseId: byCode["ADM2302"]?.id, topic: "Linear programming", pinned: true,
      body: `## Steps for any LP problem\n\n- [ ] Define decision variables (units!)\n- [ ] Write objective function\n- [ ] List all constraints (don't forget non-negativity)\n- [ ] Check linearity\n\n> Prof said: *"If your shadow price is negative, re-read the constraint direction."*\n\n\`\`\`\nmax 3x + 5y\ns.t. x + 2y <= 40\n     3x + y <= 60\n\`\`\``,
    },
    {
      title: "Quiz 1 study plan — ITI1120", courseId: byCode["ITI1120"]?.id, topic: "Quiz prep",
      body: `# Quiz 1 covers\n\n1. Variables & types\n2. Conditionals\n3. While loops\n\n**Weak spots:** nested loops, off-by-one errors.\n\n- [x] Redo lab 2 exercises\n- [ ] Practice set from Module A\n- [ ] Time a mock quiz (30 min)`,
    },
    {
      title: "Presentation brainstorm — leadership styles", courseId: byCode["MGT1100"]?.id,
      body: `Ideas for the group presentation:\n\n- Satya Nadella (transformational) — good sources on culture change\n- Compare with transactional example\n- Framework 1: Situational leadership\n- Framework 2: Servant leadership\n\n**Ask team:** who takes slides vs. research?`,
    },
    {
      title: "Ask professor about Assignment 2 Q4", courseId: byCode["ADM1305"]?.id,
      body: `Remember to ask Prof. Roy about whether Q4 wants the inverse computed by hand or if calculator method is fine.\n\nOffice hours Monday 3–5 PM, STM 314.`,
    },
  ];
  for (const n of notes) {
    await db.note.create({ data: { userId, ...n } });
  }

  const sessions = [
    { daysAgo: 6, minutes: 50, code: "ADM2302", label: "Assignment 2 — sensitivity" },
    { daysAgo: 5, minutes: 25, code: "ITI1120", label: "Lab 2" },
    { daysAgo: 4, minutes: 90, code: "ADM1305", label: "Problem set 2" },
    { daysAgo: 3, minutes: 50, code: "ADM2302", label: "Midterm review" },
    { daysAgo: 2, minutes: 25, code: "MGT1100", label: "Case reading" },
    { daysAgo: 1, minutes: 75, code: "ADM2302", label: "Decision trees" },
    { daysAgo: 1, minutes: 25, code: "ITI1120", label: "Quiz practice" },
    { daysAgo: 0, minutes: 25, code: "ITI1120", label: "Assignment 1 functions" },
  ];
  for (const s of sessions) {
    const started = at(-s.daysAgo, 18);
    await db.studySession.create({
      data: {
        userId, courseId: byCode[s.code]?.id, label: s.label,
        mode: String(s.minutes <= 25 ? 25 : s.minutes <= 50 ? 50 : 90),
        startedAt: started, endedAt: new Date(started.getTime() + s.minutes * 60000),
        minutes: s.minutes, completed: true,
      },
    });
  }

  const adm1305 = byCode["ADM1305"];
  if (adm1305) {
    await db.quiz.create({
      data: {
        courseId: adm1305.id, title: "DGD Practice Test", kind: "exam", startAt: at(8, 10),
        durationMins: 60, location: "MRT 212", topics: "Units 1–2, focus on matrix inverses",
        weight: 0, source: "manual",
      },
    });
  }
}
