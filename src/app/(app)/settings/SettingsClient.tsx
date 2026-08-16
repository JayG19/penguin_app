"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Badge, Button, Card, CardHeader, Label, Select, Switch, toast } from "@/components/ui";
import { cn } from "@/lib/utils";

const NOTIF_OPTIONS = [
  { key: "deadlines", label: "Approaching deadlines" },
  { key: "announcements", label: "New announcements" },
  { key: "grades", label: "Grades posted" },
  { key: "content", label: "Course content updated" },
  { key: "sync", label: "Sync errors" },
] as const;

export function SettingsClient({
  userName, email, theme: initialTheme, syncMode, notificationPrefs, brightspaceMode,
}: {
  userName: string;
  email: string;
  theme: string;
  syncMode: string;
  notificationPrefs: string | null;
  brightspaceMode: "mock" | "live";
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [notifs, setNotifs] = useState<Record<string, boolean>>(() => {
    try {
      return notificationPrefs ? JSON.parse(notificationPrefs) : { deadlines: true, announcements: true, grades: true, content: true, sync: true };
    } catch {
      return { deadlines: true, announcements: true, grades: true, content: true, sync: true };
    }
  });
  const [mode, setMode] = useState(syncMode);

  async function persist(body: Record<string, unknown>) {
    await fetch("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  function applyTheme(next: string) {
    setTheme(next);
    localStorage.setItem("campushub-theme", next);
    const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    persist({ theme: next });
    toast("Theme updated");
  }

  function setNotif(key: string, value: boolean) {
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    persist({ notificationPrefs: JSON.stringify(next) });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-[13px] text-muted">Appearance, sync and notification preferences.</p>
      </div>

      <Card>
        <CardHeader title="Account" />
        <div className="px-4 pb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent font-semibold">
            {userName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div>
            <p className="text-[14px] font-medium">{userName}</p>
            <p className="text-xs text-muted">{email}</p>
          </div>
          <Badge tone="amber" className="ml-auto">Demo account</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader title="Appearance" />
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            {([["light", Sun], ["dark", Moon], ["system", Monitor]] as const).map(([t, Icon]) => (
              <button
                key={t}
                onClick={() => applyTheme(t)}
                className={cn(
                  "flex grow flex-col items-center gap-1.5 rounded-xl border p-3.5 text-[13px] font-medium capitalize",
                  theme === t ? "border-accent/50 bg-accent-soft text-accent" : "border-border-base text-muted hover:text-foreground",
                )}
                aria-pressed={theme === t}
              >
                <Icon size={17} /> {t}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Brightspace sync" />
        <div className="px-4 pb-4 space-y-3">
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted">Integration mode</span>
            <Badge tone={brightspaceMode === "mock" ? "amber" : "green"}>{brightspaceMode === "mock" ? "Demo (mock data)" : "Live"}</Badge>
          </div>
          <div>
            <Label htmlFor="s-syncmode">Sync behaviour</Label>
            <Select
              id="s-syncmode"
              value={mode}
              onChange={(e) => { setMode(e.target.value); persist({ syncMode: e.target.value }); toast("Sync preference saved"); }}
            >
              <option value="manual">Manual only</option>
              <option value="launch">Sync on sign-in</option>
              <option value="interval">Background sync while app is open</option>
            </Select>
          </div>
          <p className="text-xs text-faint">Switching to a real Brightspace tenant is a configuration change — see docs/BRIGHTSPACE.md.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notifications" />
        <div className="px-4 pb-4 space-y-2.5">
          {NOTIF_OPTIONS.map((o) => (
            <div key={o.key} className="flex items-center justify-between">
              <span className="text-[13px]">{o.label}</span>
              <Switch checked={notifs[o.key] ?? true} onChange={(v) => setNotif(o.key, v)} label={o.label} />
            </div>
          ))}
          <p className="text-xs text-faint pt-1">Notifications appear in the bell menu in the top bar.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Dashboard" />
        <div className="px-4 pb-4">
          <p className="text-[13px] text-muted mb-2">Widget layout is customized directly on the dashboard.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await persist({ widgetLayout: "" });
              toast("Dashboard layout reset to default");
            }}
          >
            Reset widget layout
          </Button>
        </div>
      </Card>
    </div>
  );
}
