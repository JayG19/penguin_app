import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { runSync } from "@/lib/sync/engine";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }
  const user = await db.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
    include: { preference: true },
  });
  if (!user || !verifyPassword(body.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  await createSession(user.id);

  // Sync-on-launch preference: fire and forget so login stays fast.
  if (user.preference?.syncMode === "launch") {
    runSync(user.id).catch((e) => console.error("Launch sync failed", e));
  }
  return NextResponse.json({ ok: true });
}
