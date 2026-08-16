import { destroySession } from "@/lib/auth";
import { ok } from "@/lib/api-helpers";

export async function POST() {
  await destroySession();
  return ok();
}
