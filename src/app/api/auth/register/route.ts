import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { createUser } from "@/lib/provision";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  inviteCode: z.string().optional(),
});

/**
 * Registration is closed unless INVITE_CODE is set, so a fresh deployment
 * can't be signed up to by whoever finds the URL.
 */
export async function POST(req: Request) {
  const expected = process.env.INVITE_CODE;
  if (!expected) {
    return NextResponse.json(
      { error: "Sign-up is closed. Ask the owner of this instance for access." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    const tooShort = parsed.error.issues.some((i) => i.path[0] === "password");
    return NextResponse.json(
      { error: tooShort ? "Password must be at least 8 characters." : "Check the details and try again." },
      { status: 400 },
    );
  }
  const { name, email, password, inviteCode } = parsed.data;

  if (inviteCode !== expected) {
    return NextResponse.json({ error: "That invite code isn't valid." }, { status: 403 });
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const user = await createUser({ name, email, password });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
