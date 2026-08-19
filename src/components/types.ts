/** Client-side DTO shapes (dates serialized to ISO strings). */

export interface CourseLite {
  id: string;
  code: string;
  name: string;
  color: string;
}

export interface CourseDTO extends CourseLite {
  term: string;
  description: string | null;
  officeHours: string | null;
  progress: number;
  brightspaceUrl: string | null;
  source: string;
  archived?: boolean;
}

export interface SubmissionDTO {
  id: string;
  status: string;
  submittedAt: string | null;
  grade: string | null;
  feedback: string | null;
  brightspaceUrl: string | null;
  source: string;
  overriddenFields?: string | null;
}

export interface AssignmentDTO {
  id: string;
  courseId: string;
  course: CourseLite;
  title: string;
  description: string | null;
  dueAt: string | null;
  weight: number | null;
  status: string;
  completionPct: number;
  estimatedHours: number | null;
  difficulty: number | null;
  priorityOverride: string | null;
  notes: string | null;
  brightspaceUrl: string | null;
  source: string;
  overriddenFields: string | null;
  submission?: SubmissionDTO | null;
}

export interface QuizDTO {
  id: string;
  courseId: string;
  course: CourseLite;
  title: string;
  kind: string;
  startAt: string | null;
  durationMins: number | null;
  location: string | null;
  topics: string | null;
  weight: number | null;
  status: string;
  priorityOverride: string | null;
  brightspaceUrl: string | null;
  source: string;
  overriddenFields: string | null;
}

export interface TaskDTO {
  id: string;
  title: string;
  kind: string;
  dueAt: string | null;
  completed: boolean;
  priorityOverride: string | null;
  notes: string | null;
  weight: number | null;
  courseId: string | null;
  course?: CourseLite | null;
}

export interface AnnouncementDTO {
  id: string;
  courseId: string;
  course: CourseLite;
  title: string;
  body: string;
  author: string | null;
  postedAt: string;
  read: boolean;
  brightspaceUrl: string | null;
  source: string;
}

export interface EventDTO {
  id: string;
  title: string;
  type: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  courseId: string | null;
  course?: CourseLite | null;
  source: string;
  /** e.g. "weekly" or "weekly:2026-12-15" (frequency, optional until-date). */
  recurrence: string | null;
}

export interface GradeItemDTO {
  id: string;
  courseId: string;
  course?: CourseLite;
  name: string;
  category: string;
  weight: number;
  score: number | null;
  maxScore: number;
  gradedAt: string | null;
  source: string;
  overriddenFields?: string | null;
}

export interface NoteDTO {
  id: string;
  title: string;
  body: string;
  topic: string | null;
  pinned: boolean;
  courseId: string | null;
  course?: CourseLite | null;
  assignmentId: string | null;
  assignment?: { id: string; title: string } | null;
  quizId: string | null;
  quiz?: { id: string; title: string } | null;
  updatedAt: string;
  createdAt: string;
}

export interface StudySessionDTO {
  id: string;
  label: string | null;
  mode: string;
  startedAt: string;
  minutes: number;
  completed: boolean;
  courseId: string | null;
  course?: CourseLite | null;
}

export interface SyncLogDTO {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  added: number;
  updated: number;
  removed: number;
  errors: number;
  details: string | null;
}

export interface ToolDTO {
  id: string;
  name: string;
  url: string;
  icon: string;
  color: string;
  order: number;
  pinned: boolean;
  builtin: boolean;
}

export interface ContactDTO {
  id: string;
  courseId: string;
  course?: { id: string; code: string; name: string; color: string };
  name: string;
  role: string;
  email: string | null;
  office: string | null;
  officeHours: string | null;
  phone: string | null;
  brightspaceUrl: string | null;
  source: string;
}
