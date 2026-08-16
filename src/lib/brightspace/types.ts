/**
 * Normalized DTOs returned by every BrightspaceService implementation.
 * The real D2L API returns different shapes per endpoint (Valence "Blocks");
 * each implementation maps its raw payloads into these before the sync
 * engine ever sees them, so swapping mock → live changes nothing downstream.
 */

export interface BSCourse {
  externalId: string; // D2L OrgUnitId
  code: string;
  name: string;
  term: string;
  description?: string;
  url?: string;
}

export interface BSContactInfo {
  externalId: string; // D2L UserId
  name: string;
  role: "professor" | "ta";
  email?: string;
  office?: string;
  officeHours?: string;
}

export interface BSModule {
  externalId: string;
  title: string;
  order: number;
  items: BSContentItem[];
}

export interface BSContentItem {
  externalId: string;
  title: string;
  type: "file" | "link" | "page" | "video";
  url?: string;
  order: number;
  updatedAt?: string;
}

export interface BSAssignment {
  externalId: string; // D2L dropbox folder Id
  title: string;
  description?: string;
  dueAt?: string; // ISO
  weight?: number;
  url?: string;
  submission?: {
    status: "not_submitted" | "submitted" | "late" | "graded" | "returned";
    submittedAt?: string;
    grade?: string;
    feedback?: string;
  };
}

export interface BSQuiz {
  externalId: string;
  title: string;
  kind: "quiz" | "midterm" | "final" | "exam";
  startAt?: string;
  durationMins?: number;
  weight?: number;
  location?: string;
  url?: string;
}

export interface BSAnnouncement {
  externalId: string;
  title: string;
  body: string;
  author?: string;
  postedAt: string;
  url?: string;
}

export interface BSGradeItem {
  externalId: string;
  name: string;
  category: string;
  weight: number;
  score?: number;
  maxScore: number;
  gradedAt?: string;
}

export interface BSResource {
  externalId: string;
  title: string;
  url: string;
  description?: string;
}

export interface BSCourseBundle {
  course: BSCourse;
  contacts: BSContactInfo[];
  modules: BSModule[];
  assignments: BSAssignment[];
  quizzes: BSQuiz[];
  announcements: BSAnnouncement[];
  grades: BSGradeItem[];
  resources: BSResource[];
}
