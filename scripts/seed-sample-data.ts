/**
 * Populates realistic sample content into an EXISTING account — the same
 * demo dataset the dev seed creates, but written into a real user rather
 * than a separate demo@student.app account with a published password.
 *
 * Safe to run against a live/production database on purpose: it explicitly
 * bypasses the BRIGHTSPACE_MODE=off guard for this one call (see the
 * serviceOverride param on runSync), while leaving the app's own "Sync Now"
 * button refusing to sync in manual mode exactly as before.
 *
 * Safe to re-run: course import is idempotent (matched by external id), but
 * the manual notes/tasks/events are NOT — running twice duplicates those.
 *
 *   npx tsx --env-file=.env scripts/seed-sample-data.ts you@example.com
 *
 * Point .env's DATABASE_URL at whichever database you want the sample data
 * in (local for local exploration, your production Neon string to see it on
 * the live site).
 */
import { db } from "../src/lib/db";
import { runSync } from "../src/lib/sync/engine";
import { MockBrightspaceService } from "../src/lib/brightspace/MockBrightspaceService";
import { addDemoManualContent } from "../src/lib/demoContent";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/seed-sample-data.ts you@example.com");
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    console.error(`No account found for ${email}. Register on the site first, then re-run this.`);
    process.exit(1);
  }

  const existingCourses = await db.course.count({ where: { userId: user.id } });
  if (existingCourses > 0) {
    console.error(
      `${email} already has ${existingCourses} course(s). Re-running would duplicate notes,\n` +
      "tasks and events (only the course import itself is safe to repeat). Aborting — clear the\n" +
      "account first if you really want a fresh sample import.",
    );
    process.exit(1);
  }

  console.log(`Importing sample courses into ${user.name} <${user.email}>…`);
  const result = await runSync(user.id, new MockBrightspaceService(0));
  console.log(`Imported: +${result.added} added, ${result.updated} updated (${result.status})`);
  if (result.status !== "success") {
    console.error("Sync reported an error — stopping before adding manual content.");
    process.exit(1);
  }

  await addDemoManualContent(user.id);
  console.log("Added sample notes, tasks, personal events and study history.");
  console.log("Done — refresh the dashboard to see it.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
