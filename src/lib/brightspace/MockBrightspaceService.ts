import type { BrightspaceService } from "./BrightspaceService";
import type {
  BSAnnouncement,
  BSAssignment,
  BSContactInfo,
  BSCourse,
  BSCourseBundle,
  BSGradeItem,
  BSModule,
  BSQuiz,
  BSResource,
} from "./types";

function at(daysFromNow: number, hour = 23, minute = 59): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const BS = "https://mycampus.brightspace.demo/d2l";

/**
 * Realistic demo Brightspace tenant. Data is generated relative to "today" so
 * the dashboard always has due-soon items. `generation` (number of completed
 * syncs) makes the source evolve: later syncs surface new announcements, a
 * posted grade, a moved quiz date and a new assignment — exercising the same
 * add/update paths a live tenant would.
 */
export class MockBrightspaceService implements BrightspaceService {
  readonly mode = "mock" as const;

  constructor(private generation = 0) {}

  async ping() {
    return { ok: true, message: "Demo Brightspace (mock data)" };
  }

  private bundles(): BSCourseBundle[] {
    const gen = this.generation;
    const bundles: BSCourseBundle[] = [
      {
        course: {
          externalId: "ou-6001",
          code: "ADM2302",
          name: "Business Analytics",
          term: "Fall 2026",
          description:
            "Introduction to management science: linear programming, decision analysis, forecasting and simulation applied to business decision-making.",
          url: `${BS}/home/6001`,
        },
        contacts: [
          { externalId: "u-301", name: "Dr. Amara Smith", role: "professor", email: "asmith@uni.demo", office: "DMS 7154", officeHours: "Tue & Thu 1:00–2:30 PM" },
          { externalId: "u-302", name: "Kevin Zhou", role: "ta", email: "kzhou@uni.demo", office: "DMS 4120", officeHours: "Fri 10:00–11:30 AM" },
        ],
        modules: [
          {
            externalId: "m-6001-1", title: "Module 1 — Linear Programming", order: 1,
            items: [
              { externalId: "ci-6001-1", title: "Lecture 1 — Intro to LP models", type: "file", url: `${BS}/le/content/6001/viewContent/1/View`, order: 1 },
              { externalId: "ci-6001-2", title: "Lecture 2 — Graphical solutions", type: "file", url: `${BS}/le/content/6001/viewContent/2/View`, order: 2 },
              { externalId: "ci-6001-3", title: "Excel Solver walkthrough", type: "video", url: `${BS}/le/content/6001/viewContent/3/View`, order: 3 },
            ],
          },
          {
            externalId: "m-6001-2", title: "Module 2 — Sensitivity Analysis", order: 2,
            items: [
              { externalId: "ci-6001-4", title: "Lecture 3 — Shadow prices", type: "file", url: `${BS}/le/content/6001/viewContent/4/View`, order: 1 },
              ...(gen >= 2
                ? [{ externalId: "ci-6001-5", title: "Lecture 4 — Duality (new slides)", type: "file" as const, url: `${BS}/le/content/6001/viewContent/5/View`, order: 2, updatedAt: at(0, 9) }]
                : []),
            ],
          },
        ],
        assignments: [
          {
            externalId: "as-6001-1", title: "Assignment 1 — LP Formulation", weight: 10,
            description: "Formulate and solve the production-mix problems in the handout. Submit a single PDF plus your Excel model.",
            dueAt: at(-9, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6001&db=1`,
            submission: { status: "graded", submittedAt: at(-10, 21, 14), grade: "17/20", feedback: "Solid formulations. Constraint 3 in Q2 was slightly off — see annotations." },
          },
          {
            externalId: "as-6001-2", title: "Assignment 2 — Sensitivity Analysis", weight: 10,
            description: "Answer the sensitivity questions for the Alpine Ridge case using your Solver report.",
            dueAt: at(-1, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6001&db=2`,
            submission: { status: "submitted", submittedAt: at(-1, 22, 3) },
          },
          {
            externalId: "as-6001-3", title: "Assignment 3 — Decision Trees", weight: 15,
            description: gen >= 1
              ? "UPDATED: Build the decision tree for the Meridian expansion case. Part C is now optional bonus. Include EMV calculations and a one-page recommendation."
              : "Build the decision tree for the Meridian expansion case. Include EMV calculations and a one-page recommendation.",
            dueAt: at(3, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6001&db=3`,
            submission: { status: "not_submitted" },
          },
        ],
        quizzes: [
          { externalId: "qz-6001-1", title: "Quiz 1 — LP Basics", kind: "quiz", startAt: at(-14, 10, 0), durationMins: 30, weight: 5, url: `${BS}/lms/quizzing/user/quiz_summary.d2l?ou=6001&qi=1` },
          { externalId: "qz-6001-2", title: "Midterm Exam", kind: "midterm", startAt: at(6, 14, 0), durationMins: 120, weight: 25, location: "MRT 250", url: `${BS}/lms/quizzing/user/quiz_summary.d2l?ou=6001&qi=2` },
          { externalId: "qz-6001-3", title: "Final Exam", kind: "final", startAt: at(38, 9, 0), durationMins: 180, weight: 35, location: "TBD" },
        ],
        announcements: [
          { externalId: "an-6001-1", title: "Welcome to ADM2302", body: "Welcome! The syllabus is posted under Content. Office hours start next week — drop by, no appointment needed.", author: "Dr. Amara Smith", postedAt: at(-18, 9, 5), url: `${BS}/le/news/6001/1/view` },
          { externalId: "an-6001-2", title: "Midterm room confirmed: MRT 250", body: "The midterm will be held in MRT 250. Bring a non-programmable calculator and your student card. One double-sided cheat sheet is allowed.", author: "Dr. Amara Smith", postedAt: at(-2, 16, 40), url: `${BS}/le/news/6001/2/view` },
          ...(gen >= 1
            ? [{ externalId: "an-6001-3", title: "Assignment 3 instructions updated", body: "I've clarified Part B and made Part C an optional bonus. Re-download the case handout — the dropbox deadline is unchanged.", author: "Dr. Amara Smith", postedAt: at(0, 8, 30), url: `${BS}/le/news/6001/3/view` }]
            : []),
        ],
        grades: [
          { externalId: "gr-6001-1", name: "Assignment 1", category: "assignment", weight: 10, score: 17, maxScore: 20, gradedAt: at(-5, 12) },
          { externalId: "gr-6001-2", name: "Quiz 1", category: "quiz", weight: 5, score: 8.5, maxScore: 10, gradedAt: at(-11, 15) },
          { externalId: "gr-6001-3", name: "Assignment 2", category: "assignment", weight: 10, maxScore: 20 },
          { externalId: "gr-6001-4", name: "Assignment 3", category: "assignment", weight: 15, maxScore: 30 },
          { externalId: "gr-6001-5", name: "Midterm Exam", category: "midterm", weight: 25, maxScore: 100 },
          { externalId: "gr-6001-6", name: "Final Exam", category: "final", weight: 35, maxScore: 100 },
        ],
        resources: [
          { externalId: "rs-6001-1", title: "Course syllabus (PDF)", url: `${BS}/le/content/6001/Home`, description: "Full course outline and grading scheme" },
          { externalId: "rs-6001-2", title: "Excel Solver add-in guide", url: "https://support.microsoft.com/office/solver", description: "Installing and using Solver" },
        ],
      },
      {
        course: {
          externalId: "ou-6002",
          code: "ADM1305",
          name: "Mathematics for Management",
          term: "Fall 2026",
          description: "Functions, matrices, linear systems, and introductory calculus with applications to management problems.",
          url: `${BS}/home/6002`,
        },
        contacts: [
          { externalId: "u-303", name: "Prof. Daniel Roy", role: "professor", email: "droy@uni.demo", office: "STM 314", officeHours: "Mon 3:00–5:00 PM" },
          { externalId: "u-304", name: "Sofia Marino", role: "ta", email: "smarino@uni.demo", officeHours: "Wed 2:00–3:00 PM (online)" },
        ],
        modules: [
          {
            externalId: "m-6002-1", title: "Unit 1 — Linear Systems & Matrices", order: 1,
            items: [
              { externalId: "ci-6002-1", title: "Notes 1.1 — Systems of equations", type: "file", url: `${BS}/le/content/6002/viewContent/1/View`, order: 1 },
              { externalId: "ci-6002-2", title: "Notes 1.2 — Matrix operations", type: "file", url: `${BS}/le/content/6002/viewContent/2/View`, order: 2 },
            ],
          },
          {
            externalId: "m-6002-2", title: "Unit 2 — Functions & Derivatives", order: 2,
            items: [
              { externalId: "ci-6002-3", title: "Notes 2.1 — Limits", type: "file", url: `${BS}/le/content/6002/viewContent/3/View`, order: 1 },
              { externalId: "ci-6002-4", title: "Practice problem set (with solutions)", type: "page", url: `${BS}/le/content/6002/viewContent/4/View`, order: 2 },
            ],
          },
        ],
        assignments: [
          {
            externalId: "as-6002-1", title: "Problem Set 1", weight: 5,
            description: "Chapters 1–2, questions listed on the sheet. Show all work.",
            dueAt: at(-6, 17, 0), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6002&db=1`,
            submission: { status: "graded", submittedAt: at(-6, 15, 22), grade: "9/10" },
          },
          {
            externalId: "as-6002-2", title: "Problem Set 2", weight: 5,
            description: "Matrix inverses and applications. Handwritten scans accepted.",
            dueAt: at(5, 17, 0), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6002&db=2`,
            submission: { status: "not_submitted" },
          },
        ],
        quizzes: [
          // gen >= 1: professor moves the quiz a day later — exercises update/conflict path
          { externalId: "qz-6002-1", title: "Quiz 2 — Matrices", kind: "quiz", startAt: gen >= 1 ? at(2, 15, 0) : at(1, 15, 0), durationMins: 45, weight: 10, url: `${BS}/lms/quizzing/user/quiz_summary.d2l?ou=6002&qi=1` },
          { externalId: "qz-6002-2", title: "Midterm Exam", kind: "midterm", startAt: at(12, 9, 0), durationMins: 120, weight: 25, location: "STM 117" },
          { externalId: "qz-6002-3", title: "Final Exam", kind: "final", startAt: at(41, 14, 0), durationMins: 180, weight: 40, location: "TBD" },
        ],
        announcements: [
          { externalId: "an-6002-1", title: "Problem Set 1 solutions posted", body: "Solutions are under Content > Unit 1. Common mistakes on Q4 are covered in this week's DGD.", author: "Prof. Daniel Roy", postedAt: at(-4, 11, 15), url: `${BS}/le/news/6002/1/view` },
          ...(gen >= 1
            ? [{ externalId: "an-6002-2", title: "Quiz 2 moved one day later", body: "Due to the department event, Quiz 2 moves to the next day, same time and room. Coverage is unchanged (Unit 1).", author: "Prof. Daniel Roy", postedAt: at(0, 7, 55), url: `${BS}/le/news/6002/2/view` }]
            : []),
        ],
        grades: [
          { externalId: "gr-6002-1", name: "Problem Set 1", category: "assignment", weight: 5, score: 9, maxScore: 10, gradedAt: at(-3, 10) },
          { externalId: "gr-6002-2", name: "Problem Set 2", category: "assignment", weight: 5, maxScore: 10 },
          { externalId: "gr-6002-3", name: "Quiz 2", category: "quiz", weight: 10, maxScore: 20 },
          { externalId: "gr-6002-4", name: "Midterm Exam", category: "midterm", weight: 25, maxScore: 100 },
          { externalId: "gr-6002-5", name: "Final Exam", category: "final", weight: 40, maxScore: 100 },
          { externalId: "gr-6002-6", name: "DGD Participation", category: "participation", weight: 15, score: gen >= 1 ? 14 : undefined, maxScore: 15, gradedAt: gen >= 1 ? at(0, 9, 45) : undefined },
        ],
        resources: [
          { externalId: "rs-6002-1", title: "Formula sheet", url: `${BS}/le/content/6002/Home`, description: "Allowed on quizzes" },
        ],
      },
      {
        course: {
          externalId: "ou-6003",
          code: "MGT1100",
          name: "Introduction to Management",
          term: "Fall 2026",
          description: "Foundations of management: planning, organizing, leading and controlling in modern organizations, with case-based learning.",
          url: `${BS}/home/6003`,
        },
        contacts: [
          { externalId: "u-305", name: "Dr. Lena Okafor", role: "professor", email: "lokafor@uni.demo", office: "DMS 5140", officeHours: "By appointment (book via email)" },
        ],
        modules: [
          {
            externalId: "m-6003-1", title: "Week 1–3 — Foundations", order: 1,
            items: [
              { externalId: "ci-6003-1", title: "Case: Patagonia's org design", type: "file", url: `${BS}/le/content/6003/viewContent/1/View`, order: 1 },
              { externalId: "ci-6003-2", title: "Reading: Mintzberg on managerial roles", type: "link", url: "https://hbr.org/1990/03/the-managers-job-folklore-and-fact", order: 2 },
            ],
          },
        ],
        assignments: [
          {
            externalId: "as-6003-1", title: "Case Brief — Patagonia", weight: 10,
            description: "Two-page brief: identify the core organizational-design decision and defend a recommendation.",
            dueAt: at(8, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6003&db=1`,
            submission: { status: "not_submitted" },
          },
          {
            externalId: "as-6003-2", title: "Group Presentation — Leadership Styles", weight: 20,
            description: "12-minute group presentation analyzing a leader's style using two frameworks from class.",
            dueAt: at(15, 10, 0), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6003&db=2`,
            submission: { status: "not_submitted" },
          },
          ...(gen >= 2
            ? [{
                externalId: "as-6003-3", title: "Reflection Memo 1", weight: 5,
                description: "One-page reflection on the first three weeks: which management concept challenged your assumptions most, and why?",
                dueAt: at(10, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6003&db=3`,
                submission: { status: "not_submitted" as const },
              }]
            : []),
        ],
        quizzes: [
          { externalId: "qz-6003-1", title: "Concepts Check 1", kind: "quiz", startAt: at(4, 11, 30), durationMins: 20, weight: 5, url: `${BS}/lms/quizzing/user/quiz_summary.d2l?ou=6003&qi=1` },
          { externalId: "qz-6003-2", title: "Final Exam", kind: "final", startAt: at(44, 9, 0), durationMins: 120, weight: 30, location: "TBD" },
        ],
        announcements: [
          { externalId: "an-6003-1", title: "Group presentation sign-up open", body: "Sign-up sheet for presentation slots is now open under Content. Groups of 4–5. First come, first served.", author: "Dr. Lena Okafor", postedAt: at(-1, 13, 20), url: `${BS}/le/news/6003/1/view` },
        ],
        grades: [
          { externalId: "gr-6003-1", name: "Case Brief", category: "assignment", weight: 10, maxScore: 20 },
          { externalId: "gr-6003-2", name: "Group Presentation", category: "project", weight: 20, maxScore: 100 },
          { externalId: "gr-6003-3", name: "Concepts Checks", category: "quiz", weight: 15, score: undefined, maxScore: 100 },
          { externalId: "gr-6003-4", name: "Participation", category: "participation", weight: 25, score: 21, maxScore: 25, gradedAt: at(-7, 9) },
          { externalId: "gr-6003-5", name: "Final Exam", category: "final", weight: 30, maxScore: 100 },
        ],
        resources: [
          { externalId: "rs-6003-1", title: "Case-writing guide", url: `${BS}/le/content/6003/Home`, description: "How to structure a case brief" },
        ],
      },
      {
        course: {
          externalId: "ou-6004",
          code: "ITI1120",
          name: "Introduction to Computing",
          term: "Fall 2026",
          description: "Problem solving and algorithm design in Python: control structures, functions, lists, recursion and testing.",
          url: `${BS}/home/6004`,
        },
        contacts: [
          { externalId: "u-306", name: "Dr. Marcus Vieira", role: "professor", email: "mvieira@uni.demo", office: "SITE 5072", officeHours: "Thu 10:00 AM–12:00 PM" },
          { externalId: "u-307", name: "Priya Natarajan", role: "ta", email: "pnatarajan@uni.demo", officeHours: "Tue 4:00–5:30 PM, SITE lab 0110" },
          { externalId: "u-308", name: "Alex Fontaine", role: "ta", email: "afontaine@uni.demo", officeHours: "Fri 1:00–2:30 PM, SITE lab 0110" },
        ],
        modules: [
          {
            externalId: "m-6004-1", title: "Module A — Python Basics", order: 1,
            items: [
              { externalId: "ci-6004-1", title: "Slides A1 — Variables & types", type: "file", url: `${BS}/le/content/6004/viewContent/1/View`, order: 1 },
              { externalId: "ci-6004-2", title: "Slides A2 — Control flow", type: "file", url: `${BS}/le/content/6004/viewContent/2/View`, order: 2, updatedAt: gen >= 1 ? at(-1, 18) : undefined },
              { externalId: "ci-6004-3", title: "Lab 1 starter code", type: "file", url: `${BS}/le/content/6004/viewContent/3/View`, order: 3 },
            ],
          },
          {
            externalId: "m-6004-2", title: "Module B — Functions & Lists", order: 2,
            items: [
              { externalId: "ci-6004-4", title: "Slides B1 — Functions", type: "file", url: `${BS}/le/content/6004/viewContent/4/View`, order: 1 },
              { externalId: "ci-6004-5", title: "Worked examples (video)", type: "video", url: `${BS}/le/content/6004/viewContent/5/View`, order: 2 },
            ],
          },
        ],
        assignments: [
          {
            externalId: "as-6004-1", title: "Lab 2 — Control Flow", weight: 4,
            description: "Complete the six exercises in the lab notebook and submit your .py files.",
            dueAt: at(-3, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6004&db=1`,
            submission: gen >= 1
              ? { status: "graded", submittedAt: at(-3, 20, 47), grade: "10/10", feedback: "Clean solutions. Nice use of early returns." }
              : { status: "submitted", submittedAt: at(-3, 20, 47) },
          },
          {
            externalId: "as-6004-2", title: "Assignment 1 — Functions", weight: 8,
            description: "Implement the five functions in a1.py to pass the provided doctest suite. Style counts for 20%.",
            dueAt: at(1, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6004&db=2`,
            submission: { status: "not_submitted" },
          },
          {
            externalId: "as-6004-3", title: "Lab 3 — Lists", weight: 4,
            description: "List slicing and aggregation exercises.",
            dueAt: at(7, 23, 59), url: `${BS}/lms/dropbox/user/folder_submit_files.d2l?ou=6004&db=3`,
            submission: { status: "not_submitted" },
          },
        ],
        quizzes: [
          { externalId: "qz-6004-1", title: "Quiz 1 — Basics", kind: "quiz", startAt: at(2, 13, 0), durationMins: 30, weight: 10, url: `${BS}/lms/quizzing/user/quiz_summary.d2l?ou=6004&qi=1` },
          { externalId: "qz-6004-2", title: "Midterm Exam", kind: "midterm", startAt: at(19, 18, 0), durationMins: 110, weight: 25, location: "SITE 0131" },
          { externalId: "qz-6004-3", title: "Final Exam", kind: "final", startAt: at(46, 9, 0), durationMins: 180, weight: 35, location: "TBD" },
        ],
        announcements: [
          { externalId: "an-6004-1", title: "New lecture slides uploaded", body: "Slides A2 were updated with extra examples on while-loops. The lab this week uses them heavily.", author: "Dr. Marcus Vieira", postedAt: at(-1, 17, 5), url: `${BS}/le/news/6004/1/view` },
          { externalId: "an-6004-2", title: "Quiz 1 practice questions", body: "A practice set for Quiz 1 is posted under Module A. Solutions drop two days before the quiz.", author: "Dr. Marcus Vieira", postedAt: at(-2, 9, 50), url: `${BS}/le/news/6004/2/view` },
          ...(gen >= 1
            ? [{ externalId: "an-6004-3", title: "Lab 2 grades released", body: "Lab 2 grades are posted. See the feedback annotations on your submission. Regrade requests open for 7 days.", author: "Priya Natarajan", postedAt: at(0, 10, 10), url: `${BS}/le/news/6004/3/view` }]
            : []),
        ],
        grades: [
          { externalId: "gr-6004-1", name: "Lab 1", category: "assignment", weight: 4, score: 9, maxScore: 10, gradedAt: at(-8, 14) },
          { externalId: "gr-6004-2", name: "Lab 2", category: "assignment", weight: 4, score: gen >= 1 ? 10 : undefined, maxScore: 10, gradedAt: gen >= 1 ? at(0, 10) : undefined },
          { externalId: "gr-6004-3", name: "Assignment 1", category: "assignment", weight: 8, maxScore: 100 },
          { externalId: "gr-6004-4", name: "Quiz 1", category: "quiz", weight: 10, maxScore: 20 },
          { externalId: "gr-6004-5", name: "Midterm Exam", category: "midterm", weight: 25, maxScore: 100 },
          { externalId: "gr-6004-6", name: "Final Exam", category: "final", weight: 35, maxScore: 100 },
          { externalId: "gr-6004-7", name: "Labs 3–6", category: "assignment", weight: 14, maxScore: 100 },
        ],
        resources: [
          { externalId: "rs-6004-1", title: "Python 3 documentation", url: "https://docs.python.org/3/", description: "Official reference" },
          { externalId: "rs-6004-2", title: "Course style guide", url: `${BS}/le/content/6004/Home`, description: "Required code style for assignments" },
        ],
      },
    ];
    return bundles;
  }

  private bundle(courseExternalId: string): BSCourseBundle | undefined {
    return this.bundles().find((b) => b.course.externalId === courseExternalId);
  }

  async getCourses(): Promise<BSCourse[]> {
    return this.bundles().map((b) => b.course);
  }
  async getCourseDetails(id: string): Promise<BSCourse | null> {
    return this.bundle(id)?.course ?? null;
  }
  async getCourseContent(id: string): Promise<BSModule[]> {
    return this.bundle(id)?.modules ?? [];
  }
  async getAssignments(id: string): Promise<BSAssignment[]> {
    return this.bundle(id)?.assignments ?? [];
  }
  async getQuizzes(id: string): Promise<BSQuiz[]> {
    return this.bundle(id)?.quizzes ?? [];
  }
  async getAnnouncements(id: string): Promise<BSAnnouncement[]> {
    return this.bundle(id)?.announcements ?? [];
  }
  async getUsers(id: string): Promise<BSContactInfo[]> {
    return this.bundle(id)?.contacts ?? [];
  }
  async getGrades(id: string): Promise<BSGradeItem[]> {
    return this.bundle(id)?.grades ?? [];
  }
  async getResources(id: string): Promise<BSResource[]> {
    return this.bundle(id)?.resources ?? [];
  }
}
