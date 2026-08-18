import { withAuth, ok } from "@/lib/api-helpers";
import { scanNudges } from "@/lib/nudges/engine";

/** Recomputes automatic nudges from current deadlines and preferences. */
export const POST = withAuth(async (_req, user) => {
  const result = await scanNudges(user.id);
  return ok(result);
});
