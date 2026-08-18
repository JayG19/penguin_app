"use client";

import { useEffect, useState } from "react";
import { AlarmClock, Trash2 } from "lucide-react";
import { Button, Input, Menu, MenuItem, toast } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import type { NudgeDTO } from "./NudgeProvider";

interface Props {
  title: string;
  entityType: string;
  entityId: string;
  /** Deadline the presets are measured against; falls back to "from now". */
  dueAt?: string | null;
  size?: "xs" | "sm";
}

const PRESETS: { label: string; minutesFromNow?: number; hoursBeforeDue?: number }[] = [
  { label: "In 1 hour", minutesFromNow: 60 },
  { label: "In 3 hours", minutesFromNow: 180 },
  { label: "Tonight (8pm)", minutesFromNow: -1 },
  { label: "Tomorrow morning", minutesFromNow: -2 },
  { label: "1 day before due", hoursBeforeDue: 24 },
  { label: "3 days before due", hoursBeforeDue: 72 },
];

function resolve(preset: (typeof PRESETS)[number], dueAt?: string | null): Date | null {
  const now = new Date();
  if (preset.hoursBeforeDue != null) {
    if (!dueAt) return null;
    const d = new Date(new Date(dueAt).getTime() - preset.hoursBeforeDue * 3600_000);
    return d > now ? d : null;
  }
  if (preset.minutesFromNow === -1) {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  if (preset.minutesFromNow === -2) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  return new Date(now.getTime() + (preset.minutesFromNow ?? 60) * 60_000);
}

/** "Remind me" control: presets plus a custom date/time, scoped to one item. */
export function RemindButton({ title, entityType, entityId, dueAt, size = "sm" }: Props) {
  const [existing, setExisting] = useState<NudgeDTO[]>([]);
  const [custom, setCustom] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/nudges?entityType=${entityType}&entityId=${entityId}`);
      if (!res.ok) return;
      const data = await res.json();
      setExisting([...(data.due ?? []), ...(data.scheduled ?? [])].filter((n: NudgeDTO) => n.kind === "manual"));
    } catch {}
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function create(when: Date) {
    const res = await fetch("/api/nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: "Your reminder",
        remindAt: when.toISOString(),
        category: "custom",
        entityType,
        entityId,
      }),
    });
    if (res.ok) {
      toast(`Reminder set for ${fmtDate(when, true)}`);
      setCustom("");
      load();
      window.dispatchEvent(new CustomEvent("nudges:changed"));
    } else {
      toast("Could not set reminder", "error");
    }
  }

  async function remove(id: string) {
    await fetch(`/api/nudges/${id}`, { method: "DELETE" });
    toast("Reminder removed");
    load();
    window.dispatchEvent(new CustomEvent("nudges:changed"));
  }

  return (
    <Menu
      trigger={
        <Button size={size} variant={existing.length ? "primary" : "secondary"}>
          <AlarmClock size={size === "xs" ? 11 : 13} />
          {existing.length ? `Reminder${existing.length > 1 ? ` ×${existing.length}` : ""}` : "Remind me"}
        </Button>
      }
    >
      <div className="w-60">
        {existing.length > 0 && (
          <div className="border-b border-border-base pb-1 mb-1">
            <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Set</p>
            {existing.map((n) => (
              <div key={n.id} className="flex items-center gap-2 px-3 py-1 text-[13px]">
                <span className="grow truncate">{fmtDate(n.remindAt, true)}</span>
                <button onClick={() => remove(n.id)} className="text-faint hover:text-rose-500" aria-label="Remove reminder">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {PRESETS.map((p) => {
          const when = resolve(p, dueAt);
          if (!when) return null;
          return (
            <MenuItem key={p.label} onClick={() => create(when)}>
              <AlarmClock size={12} className="text-muted" />
              <span className="grow">{p.label}</span>
              <span className="text-[10px] text-faint">{fmtDate(when)}</span>
            </MenuItem>
          );
        })}
        <div className="border-t border-border-base mt-1 pt-2 px-3 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">Custom</p>
          <div className="flex gap-1.5">
            <Input
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="h-8 text-xs"
              aria-label="Custom reminder time"
            />
            <Button
              size="xs"
              variant="primary"
              disabled={!custom}
              onClick={() => custom && create(new Date(custom))}
            >
              Set
            </Button>
          </div>
        </div>
      </div>
    </Menu>
  );
}
