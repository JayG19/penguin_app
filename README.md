# CampusHub — Student Dashboard with Brightspace Sync

A full-stack academic workspace for university students: courses, assignments, quizzes & exams,
grades, calendar, announcements, notes, submission tracking, contacts, focus timer and study
analytics — all in one place, kept in sync with D2L Brightspace and fully editable by hand where
Brightspace can't provide the data.

Works fully **without** a Brightspace connection — every record can be created and
maintained by hand — and switches to automatic sync when API credentials arrive.

---

## Quick start (local)

Needs Node 20+ and a PostgreSQL database (a local one, or a free Neon branch).

```bash
cp .env.example .env          # set DATABASE_URL, SESSION_SECRET, INVITE_CODE; BRIGHTSPACE_MODE=mock
npm install
npx prisma migrate dev        # creates the schema
npm run db:seed               # demo student + mock Brightspace import (dev only)
npm run dev                   # http://localhost:3000
```

Demo login after seeding: `demo@student.app` / `demo1234`.

To deploy your own private instance, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**
(Vercel + Neon, invite-only sign-up, manual mode).

> No lockfile is committed; `npm install` resolves from the ranges in `package.json`.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (runs pending migrations first) / serve |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply migrations to a deployed database |
| `npm run db:seed` | (Re-)seed demo data — dev only, refuses to run in production |
| `npm run create-user` | Create a real account from the CLI |
| `npm run db:studio` | Prisma Studio DB browser |

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
Prisma ORM → PostgreSQL
```

Layers are kept separate: route handlers only validate/authorize and call into `src/lib`; the
sync engine only talks to the `BrightspaceService` interface; nothing in the frontend knows
whether data came from the mock or the live API.

## Tech stack

- **Next.js 16** (App Router, server components + route handlers), **React 19**, **TypeScript**
- **Tailwind CSS v4** design system (light/dark/system theme), lucide-react icons
- **Prisma + PostgreSQL** with migrations (`prisma/migrations`)
- **zod** input validation, **jose** JWT session cookies, node `scrypt` password hashing,
  AES-256-GCM encryption for stored OAuth tokens
- No heavyweight UI/calendar/markdown libraries — the drawers, command palette, calendar and
  markdown renderer are small local implementations

## Database structure

Core models (see `prisma/schema.prisma`): `User`, `UserPreference`, `University`, `Course`,
`Enrollment`, `Contact` (professors/TAs), `ContentModule` + `ContentItem`, `Assignment`,
`Submission` (1:1 with assignment), `Quiz` (kind: quiz/midterm/final/exam), `Announcement`,
`GradeItem`, `Note`, `CalendarEvent`, `Task`, `Resource`, `Tool`, `Notification`, `SyncLog`,
`StudySession`, `Nudge`, `BrightspaceConnection`.

Every syncable record carries:

- `source` — `"brightspace" | "manual"` (shown as a badge everywhere in the UI)
- `externalId` — unique Brightspace entity id, used to de-duplicate on every sync
- `brightspaceRaw` — the last-synced values (JSON)
- `overriddenFields` — JSON array of field names the user edited locally

## Nudges

Reminders come from two directions, both stored as `Nudge` rows:

- **Automatic** — `scanNudges()` (`src/lib/nudges/engine.ts`) derives reminders from live
  deadlines at each configured lead time (default 3 days / 1 day / 3 hours), plus one-shot nudges
  for new announcements and freshly posted grades. Each (item, lead time) pair maps to one stable
  row, so re-scanning is idempotent: a dismissed nudge never returns, and a deadline that moves
  drags its pending reminder with it. Quiet hours push a reminder to the end of the window.
- **Manual** — the **Remind me** button on any assignment, exam or submission sets a one-off
  reminder (presets relative to the due date, or a custom date/time).

Due nudges appear as a small stack in the corner with **Open · 1h · Tomorrow · Got it**. Lead
times, categories, a minimum-weight threshold and quiet hours are all configurable in Settings.

## Priority model

`computePriority()` tiers items by **days until due first** — an assignment due sooner is never
outranked by one due later, regardless of weight. Tier is a pure function of the deadline
(overdue/≤2 days → High, ≤7 days → Medium, beyond → Low); weight still drives fine-grained
ordering within a tier via `priorityScore()` (e.g. in the "What to work on" widget's top picks).
Two states sit outside the high/medium/low scale:

- **Final check** — work at 100% completion that hasn't been submitted yet. Reaching 100% promotes
  the status to `final_check` automatically; it never reads as "low priority" just because the
  writing is done.
- **Done** — submitted or completed, and out of the queue entirely.

Manual priority overrides always win, and the colour scheme (classic / accessible / monochrome) is
a user preference.

## Appearance

Theme (light/dark/system), accent colour (a preset swatch or any custom hex colour), background
(plain, aurora, grid, glow or a custom image URL), priority colour scheme and density are stored
per user and applied via CSS custom properties on the document root. A small pre-hydration script
restores them from `localStorage` before first paint, so there's no flash of the wrong theme.

Timezone (auto-detected from the browser, or set manually in Settings) is stored per user and used
to time nudges and quiet hours in the user's own local time rather than the server's.

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

Email + password (scrypt-hashed, per-user salt) → signed JWT (`jose`, HS256) in an httpOnly
`SameSite=Lax` cookie. `src/middleware.ts` verifies the token on every request and
redirects/401s unauthenticated traffic; every API handler additionally scopes queries to the
session user, so accounts are fully isolated from each other.

**Sign-up is closed unless `INVITE_CODE` is set** — a fresh deployment can't be registered to
by whoever finds the URL. The first account on a new instance is created with
`npm run create-user`. Brightspace credentials never reach the frontend; OAuth tokens are
AES-256-GCM encrypted at rest.

## Modes

`BRIGHTSPACE_MODE` decides where course data comes from:

| Mode | Behaviour |
| --- | --- |
| `off` (default) | **Manual mode.** No sync; everything is entered by hand. The Brightspace page explains what's missing and Sync is disabled. |
| `mock` | Demo tenant for local development. Never use in production — it would import fake courses into a real account. |
| `live` | Real Brightspace over OAuth 2.0. See [docs/BRIGHTSPACE.md](docs/BRIGHTSPACE.md). |

Switching `off` → `live` needs no code changes and preserves anything you entered manually.

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
`/api/preferences` · `/api/search?q=` · `/api/sync` ·
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
legacy/                 the repository's previous Streamlit demo, moved here so its
                        requirements.txt doesn't make Vercel try to build it as Python
```

## Production notes

- Full deployment guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
- Set a strong `SESSION_SECRET` (`openssl rand -hex 32`); never commit `.env` (gitignored).
- `npm run build` applies pending migrations, then builds.
- `public/robots.txt` disallows crawlers so a private instance stays out of search results.
