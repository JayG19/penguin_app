# Deploying CampusHub (Vercel + Neon)

This gets you a private, invite-only instance running in manual mode, ready to
switch to live Brightspace sync later without touching the frontend.

Roughly 15 minutes. Both services have free tiers that comfortably fit one
student and a few classmates.

---

## 1. Create the database (Neon)

1. Sign up at <https://neon.tech> and create a project (pick the region closest
   to you).
2. From the dashboard, copy the **pooled** connection string — the host contains
   `-pooler`. It looks like:

   ```
   postgresql://user:pass@ep-something-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   Use the pooled string: Vercel's serverless functions open many short-lived
   connections, and the pooler is what keeps you from exhausting them.

## 2. Deploy the app (Vercel)

1. Sign up at <https://vercel.com> with your GitHub account.
2. **Add New → Project**, import `penguin_app`, and set the production branch to
   `claude/student-dashboard-brightspace-na4qs1` (Settings → Git) — or merge
   that branch into `main` first and leave the default.
3. Before the first deploy, add these **Environment Variables**:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the pooled Neon string from step 1 |
   | `SESSION_SECRET` | output of `openssl rand -hex 32` |
   | `INVITE_CODE` | a phrase you'll share with classmates |
   | `BRIGHTSPACE_MODE` | `off` |

4. Deploy. The build runs `prisma migrate deploy` first, so your Neon database
   gets its tables automatically on the first build.

> **Never set `BRIGHTSPACE_MODE=mock` in production.** That's the demo tenant —
> it would import four fake courses into a real account.

## 3. Create your account

Sign-up requires the invite code, and there's no account yet. Two options:

**From the deployed site** (simplest): visit `https://your-app.vercel.app/register`
and register with the `INVITE_CODE` you set.

**From your laptop** (if you'd rather not expose sign-up at all — leave
`INVITE_CODE` unset in Vercel and run this against the production database):

```bash
DATABASE_URL="<your Neon string>" npx tsx scripts/create-user.ts "Your Name" you@uni.ca 'a-good-password'
```

## 4. Share with classmates

Send them the URL and the invite code. Each person registers their own account
and gets a completely separate workspace — every query in the app is scoped to
the signed-in user, so nobody can see anyone else's courses, grades or notes.

To revoke access, change `INVITE_CODE` in Vercel and redeploy. Existing accounts
keep working; new sign-ups need the new code. To close sign-ups entirely, delete
the variable.

---

## Going live with Brightspace later

When your university issues OAuth credentials, add them in Vercel:

```
BRIGHTSPACE_MODE=live
BRIGHTSPACE_BASE_URL=https://yourschool.brightspace.com
BRIGHTSPACE_CLIENT_ID=…
BRIGHTSPACE_CLIENT_SECRET=…
BRIGHTSPACE_REDIRECT_URI=https://your-app.vercel.app/api/brightspace/callback
BRIGHTSPACE_SCOPES=core:*:* content:*:* grades:*:*
```

Redeploy, then go to **Brightspace → Connect Brightspace account**. Give the
registered redirect URI to your admin *before* they create the app — it has to
match exactly.

**Your manual work is preserved.** Sync matches records by Brightspace ID, so
imported items appear alongside what you typed rather than replacing it. If you
edit a synced field afterwards, that field is marked *Overridden* and sync will
never overwrite it — with a "Restore Brightspace value" button if you change
your mind. Manual courses that also exist in Brightspace will appear twice
though; delete your manual copy after the first sync.

## Local development

Keep using a local database and demo data:

```bash
# .env
DATABASE_URL="postgresql://postgres@localhost:5432/campushub"
SESSION_SECRET="anything-long-for-local"
BRIGHTSPACE_MODE="mock"
INVITE_CODE="local"
```

```bash
npx prisma migrate dev
npm run db:seed     # demo student, 4 courses, refuses to run in production
npm run dev
```

## Operational notes

- **Backups.** Neon's free tier keeps a short restore window. Your data is
  typed-in coursework, so periodically export what matters:
  `pg_dump "$DATABASE_URL" > backup.sql`.
- **Cold starts.** Vercel free tier functions sleep; the first request after a
  quiet period takes a second or two.
- **Not indexed.** `public/robots.txt` disallows crawlers, so the instance won't
  show up in search results. That's obscurity, not security — the invite code
  and passwords are what actually protect it.
- **No rate limiting yet** on the login endpoint. For a private instance behind
  an invite code that's an acceptable risk; if you open sign-ups more widely,
  add one (Vercel's firewall or an upstash-backed limiter).
- **Passwords** are scrypt-hashed with a per-user salt. There's no password
  reset flow yet — recreate the account with `scripts/create-user.ts` if someone
  forgets theirs.
