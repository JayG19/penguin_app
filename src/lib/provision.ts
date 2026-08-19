import { db } from "./db";
import { hashPassword } from "./auth";

/** Tools every new account starts with; users can add, remove and reorder them. */
export const BUILTIN_TOOLS = [
  { name: "Google Docs", url: "https://docs.google.com", icon: "file-text", color: "sky" },
  { name: "Google Sheets", url: "https://sheets.google.com", icon: "table", color: "emerald" },
  { name: "Google Slides", url: "https://slides.google.com", icon: "presentation", color: "amber" },
  { name: "Google Drive", url: "https://drive.google.com", icon: "hard-drive", color: "sky" },
  { name: "Gmail", url: "https://mail.google.com", icon: "mail", color: "rose" },
  { name: "Google Calendar", url: "https://calendar.google.com", icon: "calendar", color: "sky" },
  { name: "Figma", url: "https://figma.com", icon: "pen-tool", color: "violet" },
  { name: "Canva", url: "https://canva.com", icon: "palette", color: "violet" },
  { name: "Notion", url: "https://notion.so", icon: "notebook", color: "neutral" },
  { name: "Word", url: "https://office.com/launch/word", icon: "file-text", color: "sky" },
  { name: "Excel", url: "https://office.com/launch/excel", icon: "table", color: "emerald" },
  { name: "PowerPoint", url: "https://office.com/launch/powerpoint", icon: "presentation", color: "rose" },
  { name: "ChatGPT", url: "https://chatgpt.com", icon: "bot", color: "emerald" },
  { name: "Calculator", url: "https://www.desmos.com/scientific", icon: "calculator", color: "neutral" },
  { name: "Citation Generator", url: "https://zbib.org", icon: "quote", color: "amber" },
  { name: "Unit Converter", url: "https://www.unitconverters.net", icon: "ruler", color: "neutral" },
];

/**
 * Creates an account with the defaults a usable dashboard needs: preferences
 * and the built-in tool set. Everything else starts empty — the app is fully
 * functional in manual mode with no Brightspace connection.
 */
export async function createUser({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) {
  const user = await db.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash: hashPassword(password),
      preference: {
        create: {
          theme: "system",
          syncMode: "manual",
          notificationPrefs: JSON.stringify({
            deadlines: true,
            announcements: true,
            grades: true,
            sync: true,
            content: true,
          }),
        },
      },
    },
  });

  await db.tool.createMany({
    data: BUILTIN_TOOLS.map((t, i) => ({
      ...t,
      userId: user.id,
      order: i,
      builtin: true,
      pinned: i < 6,
    })),
  });

  return user;
}
