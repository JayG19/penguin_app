"use client";

import { useEffect, useState } from "react";
import { AlarmClock, Bell, Check, Clock3, Monitor, Moon, Palette, RefreshCw, Sun, User } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select, Switch, toast } from "@/components/ui";
import { ACCENTS, BACKGROUNDS, PRIORITY_SCHEMES, accentVarsFromHex, applyAppearance, type AppearanceState } from "@/lib/appearance";
import { COMMON_TIMEZONES, detectTimezone, timezoneLabel } from "@/lib/timezone";
import type { NudgePrefs } from "@/lib/nudges/prefs";
import { cn } from "@/lib/utils";

const NOTIF_OPTIONS = [
  { key: "deadlines", label: "Approaching deadlines", hint: "Assignments and tasks coming due" },
  { key: "announcements", label: "New announcements", hint: "Posts from your courses" },
  { key: "grades", label: "Grades posted", hint: "When a mark appears in Brightspace" },
  { key: "content", label: "Course content updated", hint: "New files, slides or modules" },
  { key: "sync", label: "Sync errors", hint: "If a Brightspace sync fails" },
] as const;

const LEAD_PRESETS = [
  { hours: 168, label: "1 week" },
  { hours: 72, label: "3 days" },
  { hours: 24, label: "1 day" },
  { hours: 12, label: "12 hours" },
  { hours: 3, label: "3 hours" },
  { hours: 1, label: "1 hour" },
];

/** Consistent row: label/description on the left, control right-aligned. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border-base px-4 py-3">
        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent shrink-0">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

export function SettingsClient({
  userName,
  email,
  appearance: initialAppearance,
  timezone: initialTimezone,
  syncMode,
  notificationPrefs,
  nudgePrefs: initialNudges,
  brightspaceMode,
}: {
  userName: string;
  email: string;
  appearance: AppearanceState;
  timezone: string | null;
  syncMode: string;
  notificationPrefs: string | null;
  nudgePrefs: NudgePrefs;
  brightspaceMode: "off" | "mock" | "live";
}) {
  const [appearance, setAppearance] = useState(initialAppearance);
  const [nudges, setNudges] = useState(initialNudges);
  const [mode, setMode] = useState(syncMode);
  const [customHex, setCustomHex] = useState(initialAppearance.customAccent ?? "#4f46e5");
  const [tzMode, setTzMode] = useState<"auto" | "manual">(initialTimezone ? "manual" : "auto");
  const [timezone, setTimezone] = useState(initialTimezone ?? "");
  // Detected only after mount — the server has no notion of the browser's
  // timezone, so resolving this during render would mismatch on hydration
  // for anyone not in the server's own timezone (i.e. almost everyone).
  const [detectedTz, setDetectedTz] = useState("UTC");
  useEffect(() => setDetectedTz(detectTimezone()), []);
  const [notifs, setNotifs] = useState<Record<string, boolean>>(() => {
    try {
      return notificationPrefs ? JSON.parse(notificationPrefs) : { deadlines: true, announcements: true, grades: true, content: true, sync: true };
    } catch {
      return { deadlines: true, announcements: true, grades: true, content: true, sync: true };
    }
  });

  async function persist(body: Record<string, unknown>) {
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /** Appearance changes apply instantly, then save in the background. */
  function updateAppearance(patch: Partial<AppearanceState>, message?: string) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    applyAppearance(patch);
    try {
      const vars = next.accent === "custom" ? accentVarsFromHex(next.customAccent ?? customHex) : (() => {
        const def = ACCENTS.find((a) => a.key === next.accent) ?? ACCENTS[0];
        return { light: def.light, lightSoft: def.lightSoft, dark: def.dark, darkSoft: def.darkSoft };
      })();
      localStorage.setItem("campushub-appearance", JSON.stringify({ ...next, vars }));
      if (patch.theme) localStorage.setItem("campushub-theme", patch.theme);
    } catch {}
    persist(patch);
    if (message) toast(message);
  }

  function setTimezoneMode(mode: "auto" | "manual") {
    setTzMode(mode);
    if (mode === "auto") {
      setTimezone("");
      persist({ timezone: null });
      toast(`Time zone: ${timezoneLabel(detectedTz)} (auto-detected)`);
    }
  }

  function updateTimezone(tz: string) {
    setTimezone(tz);
    persist({ timezone: tz });
    toast("Time zone updated");
  }

  function updateNudges(patch: Partial<NudgePrefs>, message?: string) {
    const next = { ...nudges, ...patch };
    setNudges(next);
    persist({ nudgePrefs: JSON.stringify(next) });
    window.dispatchEvent(new CustomEvent("nudges:changed"));
    if (message) toast(message);
  }

  function setNotif(key: string, value: boolean) {
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    persist({ notificationPrefs: JSON.stringify(next) });
  }

  function toggleLead(hours: number) {
    const has = nudges.leadHours.includes(hours);
    const next = has ? nudges.leadHours.filter((h) => h !== hours) : [...nudges.leadHours, hours];
    if (next.length === 0) {
      toast("Keep at least one reminder time", "error");
      return;
    }
    updateNudges({ leadHours: next.sort((a, b) => b - a) });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-[13px] text-muted">Appearance, nudges, sync and notifications.</p>
      </div>

      <Section icon={<User size={15} />} title="Account">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent font-semibold">
            {userName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-medium">{userName}</p>
            <p className="text-xs text-muted truncate">{email}</p>
          </div>
        </div>
      </Section>

      <Section icon={<Palette size={15} />} title="Appearance" description="Theme, accent colour and background.">
        <div className="space-y-4">
          <div>
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {([["light", Sun], ["dark", Moon], ["system", Monitor]] as const).map(([t, Icon]) => (
                <button
                  key={t}
                  onClick={() => updateAppearance({ theme: t }, "Theme updated")}
                  aria-pressed={appearance.theme === t}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[13px] font-medium capitalize transition-colors",
                    appearance.theme === t ? "border-accent bg-accent-soft text-accent" : "border-border-base text-muted hover:text-foreground hover:border-border-strong",
                  )}
                >
                  <Icon size={16} /> {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Accent colour</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => updateAppearance({ accent: a.key }, `Accent set to ${a.label}`)}
                  aria-label={a.label}
                  aria-pressed={appearance.accent === a.key}
                  title={a.label}
                  className={cn(
                    "relative h-9 w-9 rounded-full border-2 transition-transform hover:scale-105",
                    appearance.accent === a.key ? "border-foreground" : "border-transparent",
                  )}
                  style={{ background: a.swatch }}
                >
                  {appearance.accent === a.key && (
                    <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow" />
                  )}
                </button>
              ))}
              <label
                title="Custom colour"
                className={cn(
                  "relative h-9 w-9 rounded-full border-2 cursor-pointer transition-transform hover:scale-105 flex items-center justify-center overflow-hidden",
                  appearance.accent === "custom" ? "border-foreground" : "border-transparent",
                )}
                style={{
                  background: appearance.accent === "custom" && appearance.customAccent
                    ? appearance.customAccent
                    : "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)",
                }}
              >
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    updateAppearance({ accent: "custom", customAccent: e.target.value }, "Custom accent set");
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Pick a custom accent colour"
                />
                {appearance.accent === "custom" ? (
                  <Check size={14} className="pointer-events-none text-white drop-shadow" />
                ) : (
                  <Palette size={13} className="pointer-events-none text-white drop-shadow" />
                )}
              </label>
              <Input
                value={customHex}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomHex(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) updateAppearance({ accent: "custom", customAccent: v }, "Custom accent set");
                }}
                placeholder="#4f46e5"
                maxLength={7}
                className="w-28 font-mono text-[13px]"
                aria-label="Custom accent colour hex code"
              />
            </div>
            <p className="text-[11px] text-faint mt-1.5">Pick any colour, or type its hex code — the whole app restyles around it instantly.</p>
          </div>

          <div>
            <Label>Background</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => updateAppearance({ background: b.key })}
                  aria-pressed={appearance.background === b.key}
                  title={b.hint}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-colors",
                    appearance.background === b.key ? "border-accent bg-accent-soft" : "border-border-base hover:border-border-strong",
                  )}
                >
                  <span
                    className="mb-1.5 block h-8 rounded-md border border-border-base"
                    style={{
                      background:
                        b.key === "mesh"
                          ? "radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%), radial-gradient(circle at 80% 60%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)"
                          : b.key === "grid"
                            ? "radial-gradient(var(--border-strong) 0.8px, transparent 0.8px) 0 0 / 8px 8px"
                            : b.key === "glow"
                              ? "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 40%, transparent), transparent 70%)"
                              : "var(--surface-2)",
                    }}
                  />
                  <span className="text-[11px] font-medium">{b.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Priority colours</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PRIORITY_SCHEMES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => updateAppearance({ priorityScheme: p.key }, "Priority colours updated")}
                  aria-pressed={appearance.priorityScheme === p.key}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-colors",
                    appearance.priorityScheme === p.key ? "border-accent bg-accent-soft" : "border-border-base hover:border-border-strong",
                  )}
                >
                  {/* scoped so each card previews its own scheme */}
                  <span className="flex gap-1 mb-1.5" data-priority={p.key}>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium prio-high">High</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium prio-medium">Med</span>
                  </span>
                  <span className="block text-[11px] font-medium">{p.label}</span>
                  <span className="block text-[10px] text-muted">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <Row label="Compact density" hint="Tighter spacing to fit more on screen">
            <Switch
              checked={appearance.density === "compact"}
              onChange={(v) => updateAppearance({ density: v ? "compact" : "comfortable" })}
              label="Compact density"
            />
          </Row>
        </div>
      </Section>

      <Section icon={<Clock3 size={15} />} title="Time zone" description="Used to time reminders and quiet hours correctly.">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTimezoneMode("auto")}
              aria-pressed={tzMode === "auto"}
              className={cn(
                "rounded-xl border p-2.5 text-[13px] font-medium transition-colors",
                tzMode === "auto" ? "border-accent bg-accent-soft text-accent" : "border-border-base text-muted hover:text-foreground hover:border-border-strong",
              )}
            >
              Automatic
            </button>
            <button
              onClick={() => setTimezoneMode("manual")}
              aria-pressed={tzMode === "manual"}
              className={cn(
                "rounded-xl border p-2.5 text-[13px] font-medium transition-colors",
                tzMode === "manual" ? "border-accent bg-accent-soft text-accent" : "border-border-base text-muted hover:text-foreground hover:border-border-strong",
              )}
            >
              Manual
            </button>
          </div>
          {tzMode === "auto" ? (
            <p className="text-xs text-muted" suppressHydrationWarning>
              Detected from your browser: <span className="font-medium text-foreground">{timezoneLabel(detectedTz)}</span>
            </p>
          ) : (
            <Select value={timezone || detectedTz} onChange={(e) => updateTimezone(e.target.value)} aria-label="Time zone">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{timezoneLabel(tz)}</option>
              ))}
            </Select>
          )}
        </div>
      </Section>

      <Section
        icon={<AlarmClock size={15} />}
        title="Nudges"
        description="Gentle reminders before things are due, and when something important lands."
      >
        <div className="divide-y divide-border-base">
          <Row label="Enable nudges" hint="Reminders appear in the corner of the app">
            <Switch checked={nudges.enabled} onChange={(v) => updateNudges({ enabled: v }, v ? "Nudges on" : "Nudges off")} label="Enable nudges" />
          </Row>

          <div className="py-3">
            <p className="text-[13px] font-medium">Remind me before a deadline</p>
            <p className="text-xs text-muted mt-0.5 mb-2">Pick every lead time you want a reminder at.</p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_PRESETS.map((p) => {
                const on = nudges.leadHours.includes(p.hours);
                return (
                  <button
                    key={p.hours}
                    onClick={() => toggleLead(p.hours)}
                    disabled={!nudges.enabled}
                    aria-pressed={on}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                      on ? "border-accent bg-accent-soft text-accent" : "border-border-base text-muted hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="py-3">
            <p className="text-[13px] font-medium mb-2">Nudge me about</p>
            <div className="space-y-1">
              {([
                ["deadline", "Assignment & task deadlines"],
                ["exam", "Quizzes and exams"],
                ["announcement", "New announcements"],
                ["grade", "Grades being posted"],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 py-1">
                  <span className="text-[13px]">{label}</span>
                  <Switch
                    checked={nudges.categories[key]}
                    disabled={!nudges.enabled}
                    onChange={(v) => updateNudges({ categories: { ...nudges.categories, [key]: v } })}
                    label={label}
                  />
                </div>
              ))}
            </div>
          </div>

          <Row label="Only nudge for work worth at least" hint="Ignore low-stakes items">
            <Select
              value={String(nudges.minWeight)}
              onChange={(e) => updateNudges({ minWeight: Number(e.target.value) })}
              className="w-28"
              disabled={!nudges.enabled}
              aria-label="Minimum weight"
            >
              <option value="0">Anything</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="20">20%</option>
            </Select>
          </Row>

          <Row label="Quiet hours" hint="Reminders wait until the window ends">
            <div className="flex items-center gap-1.5">
              <Select
                value={String(nudges.quietStart ?? "")}
                onChange={(e) => updateNudges({ quietStart: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-20"
                disabled={!nudges.enabled}
                aria-label="Quiet hours start"
              >
                <option value="">Off</option>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
              </Select>
              <span className="text-xs text-muted">to</span>
              <Select
                value={String(nudges.quietEnd ?? "")}
                onChange={(e) => updateNudges({ quietEnd: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-20"
                disabled={!nudges.enabled || nudges.quietStart == null}
                aria-label="Quiet hours end"
              >
                <option value="">Off</option>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
              </Select>
            </div>
          </Row>
        </div>
        <p className="text-[11px] text-faint mt-2">
          You can also set a one-off reminder on any assignment or exam with its “Remind me” button.
        </p>
      </Section>

      <Section icon={<RefreshCw size={15} />} title="Brightspace sync">
        <div className="divide-y divide-border-base">
          <Row
            label="Integration mode"
            hint={
              brightspaceMode === "off"
                ? "Manual mode — add everything by hand"
                : brightspaceMode === "mock"
                  ? "Demo data — no real account connected"
                  : "Connected to a live tenant"
            }
          >
            <Badge tone={brightspaceMode === "off" ? "neutral" : brightspaceMode === "mock" ? "amber" : "green"}>
              {brightspaceMode === "off" ? "Manual" : brightspaceMode === "mock" ? "Demo" : "Live"}
            </Badge>
          </Row>
          <Row label="When to sync">
            <Select
              value={mode}
              onChange={(e) => { setMode(e.target.value); persist({ syncMode: e.target.value }); toast("Sync preference saved"); }}
              className="w-56"
              aria-label="Sync behaviour"
            >
              <option value="manual">Manual only</option>
              <option value="launch">Sync on sign-in</option>
              <option value="interval">Background while app is open</option>
            </Select>
          </Row>
        </div>
        <p className="text-[11px] text-faint mt-2">
          Connecting a real tenant is a configuration change — see docs/BRIGHTSPACE.md.
        </p>
      </Section>

      <Section icon={<Bell size={15} />} title="Notifications" description="What shows up in the bell menu.">
        <div className="divide-y divide-border-base">
          {NOTIF_OPTIONS.map((o) => (
            <Row key={o.key} label={o.label} hint={o.hint}>
              <Switch checked={notifs[o.key] ?? true} onChange={(v) => setNotif(o.key, v)} label={o.label} />
            </Row>
          ))}
        </div>
      </Section>

      <Section icon={<Palette size={15} />} title="Dashboard">
        <Row label="Widget layout" hint="Reorder by dragging, show or hide from the Widgets menu">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await persist({ widgetLayout: "" });
              toast("Dashboard layout reset — reload to see it");
            }}
          >
            Reset layout
          </Button>
        </Row>
      </Section>
    </div>
  );
}
