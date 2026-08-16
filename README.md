# CampusHub — Student Dashboard with Brightspace Sync

A full-stack academic workspace for university students: courses, assignments, quizzes & exams,
grades, calendar, announcements, notes, submission tracking, contacts, focus timer and study
analytics — all in one place, kept in sync with D2L Brightspace and fully editable by hand where
Brightspace can't provide the data.

**Demo login:** `demo@student.app` / `demo1234`

---

## Quick start

```bash
cp .env.example .env          # fill SESSION_SECRET (openssl rand -hex 32); keep DATABASE_URL as-is
pnpm install
npx prisma migrate dev        # creates prisma/dev.db and applies migrations
pnpm db:seed                  # demo user + initial Brightspace (mock) sync + manual demo data
pnpm dev                      # http://localhost:3000
```

Or all at once after filling `.env`: `pnpm setup`.

> No lockfile is committed; `pnpm install` resolves from the ranges in `package.json`
> (pinned `next`/`react`, Prisma 6, `packageManager: pnpm@10`).

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Create/apply migrations |
| `pnpm db:seed` | (Re-)seed demo data — safe to re-run, wipes and recreates the demo user |
| `pnpm db:reset` | Drop + re-migrate + reseed |
| `pnpm db:studio` | Prisma Studio DB browser |

---

## Architecture

```
Browser (React 19 / Next.js App Router)
  │  server components fetch via Prisma; client widgets mutate via fetch()
  ▼
Next.js Route Handlers  (src/app/api/**)      ← zod validation, per-user authorization
  │
  ├── Business logic    (src/lib/priority.ts, grades.ts, quickcapture.ts)
  ├── Sync engine       (src/lib/sync/engine.ts, overrides.ts)
  │       │
  │       ▼
  │   BrightspaceService interface (src/lib/brightspace/BrightspaceService.ts)
  │       ├── MockBrightspaceService   — demo tenant, evolves between syncs
  │       └── D2LBrightspaceService    — real Valence API over OAuth 2.0
  ▼
Prisma ORM → SQLite (swap the datasource for Postgres/MySQL in production)
```

Layers are kept separate: route handlers only validate/authorize and call into `src/lib`; the
sync engine only talks to the `BrightspaceService` interface; nothing in the frontend knows
whether data came from the mock or the live API.

## Tech stack

- **Next.js 16** (App Router, server components + route handlers), **React 19**, **TypeScript**
- **Tailwind CSS v4** design system (light/dark/system theme), lucide-react icons
- **Prisma + SQLite** with migrations (`prisma/migrations`)
- **zod** input validation, **jose** JWT session cookies, node `scrypt` password hashing,
  AES-256-GCM encryption for stored OAuth tokens
- No heavyweight UI/calendar/markdown libraries — the drawers, command palette, calendar and
  markdown renderer are small local implementations

## Database structure

Core models (see `prisma/schema.prisma`): `User`, `UserPreference`, `University`, `Course`,
`Enrollment`, `Contact` (professors/TAs), `ContentModule` + `ContentItem`, `Assignment`,
`Submission` (1:1 with assignment), `Quiz` (kind: quiz/midterm/final/exam), `Announcement`,
`GradeItem`, `Note`, `CalendarEvent`, `Task`, `Resource`, `Tool`, `Notification`, `SyncLog`,
`StudySession`, `BrightspaceConnection`.

Every syncable record carries:

- `source` — `"brightspace" | "manual"` (shown as a badge everywhere in the UI)
- `externalId` — unique Brightspace entity id, used to de-duplicate on every sync
- `brightspaceRaw` — the last-synced values (JSON)
- `overriddenFields` — JSON array of field names the user edited locally

## Brightspace integration approach

D2L's Valence API is not a simple public API: it requires an **OAuth 2.0 app registered by a
Brightspace admin** (legacy ID-Key auth is deprecated since 20.23.1). The integration is therefore
built as a swappable service behind one interface — `getCourses()`, `getCourseDetails()`,
`getCourseContent()`, `getAssignments()`, `getQuizzes()`, `getAnnouncements()`, `getUsers()`,
`getGrades()`, `getResources()`:

- **Demo mode (default, `BRIGHTSPACE_MODE=mock`)** — `MockBrightspaceService` serves a realistic
  4-course tenant with dates relative to "today". It *evolves* between syncs (new announcements, a
  posted grade, a moved quiz date, a new assignment), so the sync pipeline, diffing, notifications
  and conflict handling are exercised exactly as they would be live.
- **Live mode (`BRIGHTSPACE_MODE=live`)** — `D2LBrightspaceService` implements the OAuth 2.0
  authorization-code flow (`/api/brightspace/connect` → D2L auth service →
  `/api/brightspace/callback`), refreshes tokens automatically, stores them AES-encrypted per
  user, and maps LP/LE endpoints (enrollments, content ToC, dropbox folders, quizzes, news,
  classlist, grade values) into the shared DTOs.

Setup for a real tenant is documented in [`docs/BRIGHTSPACE.md`](docs/BRIGHTSPACE.md).

## Authentication approach

Email + password (scrypt-hashed) → signed JWT (`jose`, HS256) in an httpOnly `SameSite=Lax`
cookie. `src/middleware.ts` verifies the token on every request and redirects/401s
unauthenticated traffic; every API handler additionally scopes queries to the session user.
Brightspace credentials never reach the frontend; OAuth tokens are encrypted at rest.

## Sync strategy

`runSync(userId)` (`src/lib/sync/engine.ts`):

1. Creates a `SyncLog` row (`running`), fetches all courses from the service, then per course:
   contacts, content, assignments+submissions, quizzes, announcements, grades, resources.
2. **Upsert by `externalId`** — records are matched, never duplicated. New records → `added`;
   changed fields → `updated`; Brightspace records that vanished remotely → deleted (`removed`).
3. **Conflict handling** — a field listed in `overriddenFields` is never overwritten; the incoming
   value is kept in `brightspaceRaw`, the conflict is logged, and the UI shows an **Overridden**
   badge with **Restore Brightspace value** (field-level restore).
4. Generates notifications (new assignment/quiz/announcement, grade posted, date changed,
   content updated, sync errors) and finalizes the log with counts + a per-item change list
   (visible on the Brightspace page and in the "What's New" widget).

Sync triggers: **Sync Now** (dashboard widget, Brightspace page, ⌘K), **on sign-in**, or
**background interval** while the app is open — configurable in Settings / Brightspace page.

## What currently requires manual entry

Anything Brightspace doesn't model or expose: personal tasks/reminders/readings, class schedule
events, personal calendar events, notes, study sessions, custom tools, estimated hours/difficulty,
completion %, priorities, exam location/topics when missing, and any courses/contacts/grades not
in Brightspace. All of these are first-class manual records (`source: "manual"`) that coexist with
synced data.

## What remains mocked in demo mode

Only the Brightspace tenant itself (the data returned by `MockBrightspaceService`). Everything
else — database persistence, sync engine, conflict handling, notifications, search, grade math,
quick-capture parsing, focus/study tracking — is real and unchanged when you flip to live mode.

## API overview

All routes require an authenticated session. `GET` collections accept filters (`courseId`, `q`,
`from`/`to`); `POST` creates; `PATCH` updates (with `restore: [field]` on synced entities);
`DELETE` removes.

`/api/auth/{login,logout}` · `/api/courses[/:id]` · `/api/assignments[/:id]` ·
`/api/quizzes[/:id]` · `/api/tasks[/:id]` · `/api/notes[/:id]` · `/api/announcements[/:id]` ·
`/api/events[/:id]` · `/api/contacts[/:id]` · `/api/grades[/:id]` · `/api/submissions/:assignmentId` ·
`/api/resources` · `/api/tools[/:id]` · `/api/study-sessions` · `/api/notifications` ·
`/api/preferences` · `/api/search?q=` · `/api/quick-capture` · `/api/sync` ·
`/api/brightspace/{connect,callback}`

## Project structure

```
prisma/                 schema, migrations, seed
src/middleware.ts       session gate for pages + APIs
src/lib/                auth, db, crypto, priority, grades, quick-capture, markdown
src/lib/brightspace/    service interface + mock + live D2L client
src/lib/sync/           sync engine + override/restore helpers
src/app/api/            route handlers (thin: validate → authorize → lib)
src/app/(app)/          dashboard, courses, assignments, quizzes, calendar, announcements,
                        notes, submissions, contacts, tools, settings, sync
src/components/         design system (ui.tsx), shell (sidebar/topbar/⌘K/quick-add),
                        dashboard widgets, drawers, focus timer
docs/BRIGHTSPACE.md     live-integration setup guide
penguin_app.py, penguin.csv, requirements.txt, setup.sh, Procfile.txt
                        the repository's previous Streamlit demo (untouched)
```

## Production notes

- Swap SQLite for Postgres: change `datasource db` in `prisma/schema.prisma` and `DATABASE_URL`,
  then `prisma migrate dev`.
- Set a strong `SESSION_SECRET`; never commit `.env` (already gitignored).
- `pnpm build && pnpm start` serves the production build.
