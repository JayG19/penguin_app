import { addDays, nextDay, setHours, setMinutes, startOfDay, type Day } from "date-fns";

export interface ParsedCapture {
  title: string;
  dueAt: Date | null;
  courseHint: string | null;
}

const WEEKDAYS: Record<string, Day> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thurs: 4, fri: 5, sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Deterministic natural-language parser for quick capture, e.g.
 * "Finish business analytics assignment tomorrow at 7pm"
 * "ADM2302 reading friday", "Study for midterm sept 21 at 9am".
 */
export function parseQuickCapture(input: string, now = new Date()): ParsedCapture {
  let text = ` ${input.trim()} `;
  let date: Date | null = null;
  let hour: number | null = null;
  let minute = 0;

  // time: "at 7pm", "at 19:30", "7:30 pm"
  const timeRe = /\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=[\s.,!]|$)/i;
  const timeMatch = text.match(/\sat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=[\s.,!]|$)/i) ?? text.match(/\s(\d{1,2}):(\d{2})\s*(am|pm)?(?=[\s.,!]|$)/i) ?? text.match(/\s(\d{1,2})\s*(?:()(am|pm))(?=[\s.,!]|$)/i);
  void timeRe;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (!meridiem && hour <= 7) hour += 12; // "at 7" for a student usually means evening
    text = text.replace(timeMatch[0], " ");
  }

  // "today" / "tomorrow" / "tonight"
  if (/\btonight\b/i.test(text)) {
    date = startOfDay(now);
    if (hour == null) { hour = 20; minute = 0; }
    text = text.replace(/\btonight\b/i, " ");
  } else if (/\btomorrow\b/i.test(text)) {
    date = startOfDay(addDays(now, 1));
    text = text.replace(/\btomorrow\b/i, " ");
  } else if (/\btoday\b/i.test(text)) {
    date = startOfDay(now);
    text = text.replace(/\btoday\b/i, " ");
  }

  // "next friday" / "friday"
  if (!date) {
    const wd = text.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thurs|fri|sat)\b/i);
    if (wd) {
      let d = nextDay(startOfDay(now), WEEKDAYS[wd[2].toLowerCase()]);
      if (wd[1]) d = addDays(d, 7);
      date = d;
      text = text.replace(wd[0], " ");
    }
  }

  // "sept 21" / "september 21" / "21 sept"
  if (!date) {
    const md =
      text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i) ??
      text.match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if (md) {
      const monthToken = MONTHS[md[1].toLowerCase()] != null ? md[1] : md[2];
      const dayToken = MONTHS[md[1].toLowerCase()] != null ? md[2] : md[1];
      const month = MONTHS[monthToken.toLowerCase()];
      const day = parseInt(dayToken, 10);
      let d = new Date(now.getFullYear(), month, day);
      if (d < startOfDay(now)) d = new Date(now.getFullYear() + 1, month, day);
      date = d;
      text = text.replace(md[0], " ");
    }
  }

  // "in 3 days"
  if (!date) {
    const rel = text.match(/\bin\s+(\d+)\s+days?\b/i);
    if (rel) {
      date = startOfDay(addDays(now, parseInt(rel[1], 10)));
      text = text.replace(rel[0], " ");
    }
  }

  let dueAt: Date | null = null;
  if (date) {
    dueAt = hour != null ? setMinutes(setHours(date, hour), minute) : setMinutes(setHours(date, 23), 59);
  } else if (hour != null) {
    dueAt = setMinutes(setHours(startOfDay(now), hour), minute);
    if (dueAt < now) dueAt = addDays(dueAt, 1);
  }

  // course code hint like ADM2302 / ITI1120
  const courseMatch = text.match(/\b([A-Z]{3}\s?\d{4})\b/);
  const courseHint = courseMatch ? courseMatch[1].replace(/\s/, "") : null;

  const title = text.replace(/\s+/g, " ").replace(/\s+(on|by|due)\s*$/i, "").trim();
  return { title: title || input.trim(), dueAt, courseHint };
}
