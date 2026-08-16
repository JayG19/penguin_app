import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { withAuth } from "@/lib/api-helpers";
import { D2LBrightspaceService } from "@/lib/brightspace/D2LBrightspaceService";

/**
 * Starts the Brightspace OAuth 2.0 authorization-code flow.
 * Requires BRIGHTSPACE_MODE=live and app credentials in the environment.
 */
export const GET = withAuth(async () => {
  if (process.env.BRIGHTSPACE_MODE !== "live") {
    return NextResponse.json(
      { error: "Brightspace live mode is not configured. Set BRIGHTSPACE_MODE=live and the BRIGHTSPACE_* variables (see docs/BRIGHTSPACE.md)." },
      { status: 400 },
    );
  }
  const config = {
    baseUrl: process.env.BRIGHTSPACE_BASE_URL ?? "",
    clientId: process.env.BRIGHTSPACE_CLIENT_ID ?? "",
    clientSecret: process.env.BRIGHTSPACE_CLIENT_SECRET ?? "",
  };
  const redirectUri = process.env.BRIGHTSPACE_REDIRECT_URI ?? "";
  const scopes = process.env.BRIGHTSPACE_SCOPES ?? "core:*:*";
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("bs_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(D2LBrightspaceService.authorizeUrl(config, redirectUri, scopes, state));
});
