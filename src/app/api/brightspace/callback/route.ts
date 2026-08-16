import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";
import { encrypt } from "@/lib/crypto";
import { D2LBrightspaceService } from "@/lib/brightspace/D2LBrightspaceService";

/** OAuth 2.0 redirect target: exchanges the code and stores tokens encrypted. */
export const GET = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("bs_oauth_state")?.value;
  jar.delete("bs_oauth_state");
  if (!code || !state || state !== expected) {
    return NextResponse.json({ error: "Invalid OAuth state or missing code" }, { status: 400 });
  }
  const config = {
    baseUrl: process.env.BRIGHTSPACE_BASE_URL ?? "",
    clientId: process.env.BRIGHTSPACE_CLIENT_ID ?? "",
    clientSecret: process.env.BRIGHTSPACE_CLIENT_SECRET ?? "",
  };
  const tokens = await D2LBrightspaceService.exchangeCode(config, process.env.BRIGHTSPACE_REDIRECT_URI ?? "", code);
  await db.brightspaceConnection.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tokens: encrypt(JSON.stringify(tokens)) },
    update: { tokens: encrypt(JSON.stringify(tokens)) },
  });
  return NextResponse.redirect(new URL("/sync?connected=1", url.origin));
});
