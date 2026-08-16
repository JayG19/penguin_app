import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth, ok } from "@/lib/api-helpers";

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  icon: z.string().default("link"),
  color: z.string().default("neutral"),
});

const reorderSchema = z.object({ order: z.array(z.string()) });

export const GET = withAuth(async (_req, user) => {
  const tools = await db.tool.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }] });
  return ok({ tools });
});

export const POST = withAuth(async (req, user) => {
  const data = createSchema.parse(await req.json());
  const max = await db.tool.aggregate({ where: { userId: user.id }, _max: { order: true } });
  const tool = await db.tool.create({ data: { ...data, userId: user.id, order: (max._max.order ?? 0) + 1 } });
  return ok({ tool });
});

// Reorder: body { order: [toolId, ...] }
export const PATCH = withAuth(async (req, user) => {
  const { order } = reorderSchema.parse(await req.json());
  await Promise.all(
    order.map((id, index) => db.tool.updateMany({ where: { id, userId: user.id }, data: { order: index } })),
  );
  return ok();
});
