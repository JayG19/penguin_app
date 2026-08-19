import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { BUILTIN_TOOLS } from "../src/lib/provision";
import { runSync } from "../src/lib/sync/engine";
import { addDemoManualContent } from "../src/lib/demoContent";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.error(
      "Refusing to seed demo data in production. This would create a demo account with a\n" +
      "published password. Use `npm run create-user` instead, or set ALLOW_DEMO_SEED=true if\n" +
      "you really want demo data here.",
    );
    process.exit(1);
  }
  console.log("Seeding CampusHub demo data…");

  const existing = await db.user.findUnique({ where: { email: "demo@student.app" } });
  if (existing) {
    console.log("Demo user already exists — wiping and re-seeding.");
    await db.user.delete({ where: { id: existing.id } });
    await db.university.deleteMany({});
  }

  const user = await db.user.create({
    data: {
      email: "demo@student.app",
      name: "Jordan Lee",
      passwordHash: hashPassword("demo1234"),
      preference: {
        create: {
          theme: "system",
          syncMode: "launch",
          notificationPrefs: JSON.stringify({ deadlines: true, announcements: true, grades: true, sync: true, content: true }),
        },
      },
    },
  });

  await db.university.create({
    data: { name: "Demo University", brightspaceBaseUrl: "https://mycampus.brightspace.demo" },
  });

  for (const [i, t] of BUILTIN_TOOLS.entries()) {
    await db.tool.create({ data: { userId: user.id, ...t, order: i, builtin: true, pinned: i < 6 } });
  }

  // Initial import through the real sync pipeline (mock Brightspace service).
  const result = await runSync(user.id);
  console.log(`Initial Brightspace sync: +${result.added} added, ${result.updated} updated (${result.status})`);

  await addDemoManualContent(user.id);

  console.log("Seed complete. Login: demo@student.app / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
