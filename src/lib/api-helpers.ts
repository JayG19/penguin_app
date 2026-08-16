import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireUser } from "./auth";

type Handler<Ctx> = (req: Request, user: { id: string; name: string; email: string }, ctx: Ctx) => Promise<Response>;

/** Wraps a route handler with authentication + uniform error responses. */
export function withAuth<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const user = await requireUser();
      return await handler(req, user, ctx);
    } catch (e) {
      if (e instanceof AuthError) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      if (e instanceof ZodError) {
        return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const ok = (data: unknown = { ok: true }) => NextResponse.json(data);

export type IdCtx = { params: Promise<{ id: string }> };
