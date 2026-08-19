/**
 * Creates an account from the command line — the way to make the first user on
 * a fresh deployment, since sign-up requires an invite code.
 *
 *   npx tsx --env-file=.env scripts/create-user.ts "Jay G" you@uni.ca 'a-good-password'
 */
import { db } from "../src/lib/db";
import { createUser } from "../src/lib/provision";

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: tsx scripts/create-user.ts "Full Name" email@example.com password');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.error(`An account already exists for ${email}.`);
    process.exit(1);
  }
  const user = await createUser({ name, email, password });
  console.log(`Created ${user.name} <${user.email}>. You can sign in now.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
