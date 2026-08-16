# Connecting a real Brightspace (D2L) tenant

CampusHub ships in **demo mode**: a mock Brightspace tenant behind the same
`BrightspaceService` interface the live client implements. Switching to a real
tenant is configuration, not code.

## What the D2L API actually requires

The Brightspace "Valence" Learning Framework APIs are REST endpoints served by
your institution's Brightspace host (`https://<school>.brightspace.com/d2l/api/...`).
They are **not** openly accessible:

- **OAuth 2.0 (authorization-code grant) is the supported auth method.** The
  legacy ID-Key auth system is deprecated since Brightspace 20.23.1.
- An **administrator of the Brightspace org must register an OAuth 2.0
  application** (Admin Tools → *Manage Extensibility* → *OAuth 2.0* → Register
  an app). Registration produces a **client ID** and **client secret** and pins
  a **redirect URI** and **scopes**.
- Authorization happens against D2L's central auth service
  (`https://auth.brightspace.com/oauth2/auth`), token exchange and refresh at
  `https://auth.brightspace.com/core/connect/token`. Access tokens are
  short-lived (~1h) and come with refresh tokens.
- Every API call sends `Authorization: Bearer <access token>`.
- API **versions vary per tenant**. `GET /d2l/api/versions/` lists what your
  tenant supports; the client targets broadly-supported LP/LE versions and can
  be bumped in `src/lib/brightspace/D2LBrightspaceService.ts`.
- What you can read depends on the **scopes** granted at registration and the
  **permissions of the signed-in user**. A student token typically can read
  their enrollments, content, dropbox folders, quizzes, news and their own
  grades; some endpoints (e.g. full classlists) may be restricted — the client
  degrades gracefully (403/404 → empty list) so partial scopes still sync.

If your institution will not register an app for you, there is no supported way
to authenticate programmatically — that's exactly why the manual-entry system
exists. Everything the sync would import can be entered and maintained by hand.

## Configuration

1. Have an admin register the app with redirect URI
   `https://<your-host>/api/brightspace/callback` (or
   `http://localhost:3000/api/brightspace/callback` for development) and scopes
   such as `core:*:* content:*:* grades:*:*`.

2. Fill `.env`:

   ```bash
   BRIGHTSPACE_MODE="live"
   BRIGHTSPACE_BASE_URL="https://yourschool.brightspace.com"
   BRIGHTSPACE_CLIENT_ID="..."
   BRIGHTSPACE_CLIENT_SECRET="..."
   BRIGHTSPACE_REDIRECT_URI="http://localhost:3000/api/brightspace/callback"
   BRIGHTSPACE_SCOPES="core:*:* content:*:* grades:*:*"
   ```

3. Restart the app, open **Brightspace** in the sidebar and click **Connect
   Brightspace account**. You'll be redirected to D2L to approve, then back.
   Tokens are stored per user, AES-256-GCM encrypted (`BrightspaceConnection`
   table); refresh is automatic.

4. Click **Sync Now**. From here on the behaviour is identical to demo mode:
   external IDs prevent duplicates, user edits are protected as overrides, and
   changes stream into notifications and the What's New feed.

## Endpoint map used by the live client

| Data | Endpoint |
| --- | --- |
| Who am I | `GET /d2l/api/lp/{ver}/users/whoami` |
| Courses | `GET /d2l/api/lp/{ver}/enrollments/myenrollments/?orgUnitTypeId=3` (paged) |
| Course details | `GET /d2l/api/lp/{ver}/courses/{orgUnitId}` |
| Content | `GET /d2l/api/le/{ver}/{orgUnitId}/content/toc` |
| Assignments (dropbox) | `GET /d2l/api/le/{ver}/{orgUnitId}/dropbox/folders/` |
| Quizzes | `GET /d2l/api/le/{ver}/{orgUnitId}/quizzes/` |
| Announcements | `GET /d2l/api/le/{ver}/{orgUnitId}/news/` |
| Instructors/TAs | `GET /d2l/api/le/{ver}/{orgUnitId}/classlist/` (role-filtered) |
| My grades | `GET /d2l/api/le/{ver}/{orgUnitId}/grades/values/myGradeValues/` |

Notes and limitations:

- **Assignment weights** are not exposed on dropbox folders; they come from
  grade objects where available, otherwise enter them manually (weights drive
  the priority engine and grade planner).
- **Submission feedback/status** coverage varies by tenant; the submission
  tracker supports manual status updates for anything the API doesn't provide.
- Brightspace has no first-class "resources" API — link-type content topics
  appear under Content instead, and course links can be added manually.

## Security

- Client secret and tokens live server-side only; the frontend never sees them.
- Tokens are encrypted at rest with a key derived from `SESSION_SECRET`.
- The OAuth `state` parameter is validated on callback.
- Never commit `.env` (gitignored).
