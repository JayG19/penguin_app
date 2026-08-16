import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import type { ToolDTO } from "@/components/types";
import { ToolsClient } from "./ToolsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Useful Tools" };

export default async function ToolsPage() {
  const user = (await getSessionUser())!;
  const tools = await db.tool.findMany({ where: { userId: user.id }, orderBy: { order: "asc" } });
  return <ToolsClient tools={serialize<ToolDTO[]>(tools)} />;
}
