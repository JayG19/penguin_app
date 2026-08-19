"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Label, Select, Spinner, toast } from "@/components/ui";
import type { SyncLogDTO } from "@/components/types";
import type { SyncDetail } from "@/lib/sync/engine";
import { cn, timeAgo, fmtDate } from "@/lib/utils";

export function SyncClient({
  logs, mode, connected, missingConfig, syncMode, syncIntervalMins,
}: {
  logs: SyncLogDTO[];
  mode: "off" | "mock" | "live";
  connected: boolean;
  missingConfig: string[];
  syncMode: string;
  syncIntervalMins: number;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(logs[0]?.id ?? null);
  const [prefs, setPrefs] = useState({ syncMode, syncIntervalMins });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const r = await res.json();
      if (r.status === "success") toast(`Sync complete: +${r.added} added, ${r.updated} updated, ${r.removed} removed`);
      else toast(r.error ?? "Sync finished with errors", "error");
      router.refresh();
    } catch {
      toast("Sync failed", "error");
    }
    setSyncing(false);
  }

  // Background sync while the app is open, when interval mode is on.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (prefs.syncMode === "interval") {
      intervalRef.current = setInterval(() => {
        fetch("/api/sync", { method: "POST" }).then(() => router.refresh()).catch(() => {});
      }, Math.max(5, prefs.syncIntervalMins) * 60_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [prefs, router]);

  async function savePrefs(next: { syncMode?: string; syncIntervalMins?: number }) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    await fetch("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(merged) });
    toast("Sync preferences saved");
  }

  const last = logs[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Brightspace Integration</h1>
          <p className="text-[13px] text-muted">
            {mode === "off"
              ? "Manual mode — everything works by hand while Brightspace access is pending."
              : mode === "mock"
                ? "Demo mode — realistic mock Brightspace data behind the same service interface as the live API."
                : connected ? "Live mode — connected via OAuth 2.0." : "Live mode — not connected yet."}
          </p>
        </div>
        <Button variant="primary" onClick={syncNow} disabled={syncing || mode === "off"} title={mode === "off" ? "Brightspace isn't configured on this deployment" : undefined}>
          {syncing ? <Spinner className="border-white/40 border-t-white" /> : <RefreshCw size={15} />}
          {syncing ? "Syncing…" : "Sync Now"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          {mode === "off" && (
            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
              <h3 className="text-sm font-semibold mb-1">You&apos;re running in manual mode</h3>
              <p className="text-[13px] text-muted leading-relaxed">
                No Brightspace account is connected, so nothing syncs automatically. Everything in
                CampusHub still works — add your courses, assignments, exams, grades and contacts by
                hand, and they behave exactly like synced records.
              </p>
              <p className="text-[13px] text-muted leading-relaxed mt-2">
                Once your university issues OAuth credentials, set{" "}
                <code className="font-mono text-xs">BRIGHTSPACE_MODE=live</code> plus the{" "}
                <code className="font-mono text-xs">BRIGHTSPACE_*</code> variables and connect your
                account here. Your manual entries are kept — sync matches on Brightspace IDs and
                never overwrites a field you edited.
              </p>
              {missingConfig.length > 0 && (
                <p className="text-xs text-faint mt-2">
                  Still needed: <span className="font-mono">{missingConfig.join(", ")}</span>
                </p>
              )}
              <Link href="/courses" className="inline-block mt-3">
                <Button size="sm" variant="primary">Add your courses</Button>
              </Link>
            </Card>
          )}
          <Card>
            <CardHeader title="Sync history" />
            {logs.length === 0 ? (
              <EmptyState
                title="Nothing synced yet"
                hint={mode === "off" ? "Sync history appears here once Brightspace is connected." : undefined}
                actions={mode === "off" ? undefined : <Button size="sm" variant="outline" onClick={syncNow}>Run first sync</Button>}
              />
            ) : (
              <div className="divide-y divide-border-base">
                {logs.map((log) => (
                  <SyncLogRow key={log.id} log={log} expanded={expanded === log.id} onToggle={() => setExpanded(expanded === log.id ? null : log.id)} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">Status</h3>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted">Mode</span>
                <Badge tone={mode === "off" ? "neutral" : mode === "mock" ? "amber" : "green"}>
                  {mode === "off" ? "Manual" : mode === "mock" ? "Demo (mock)" : "Live"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Connection</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-500" : mode === "off" ? "bg-zinc-400" : "bg-rose-500")} />
                  {connected ? "Ready" : mode === "off" ? "Not configured" : "Not connected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Last synced</span>
                <span>{last?.finishedAt ? timeAgo(last.finishedAt) : "never"}</span>
              </div>
            </div>
            {mode === "live" && !connected && (
              <a href="/api/brightspace/connect" className="block mt-3">
                <Button size="sm" variant="primary" className="w-full">Connect Brightspace account</Button>
              </a>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">Sync preferences</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="sync-mode">When to sync</Label>
                <Select id="sync-mode" value={prefs.syncMode} onChange={(e) => savePrefs({ syncMode: e.target.value })}>
                  <option value="manual">Manual only</option>
                  <option value="launch">On sign-in</option>
                  <option value="interval">Automatically (background)</option>
                </Select>
              </div>
              {prefs.syncMode === "interval" && (
                <div>
                  <Label htmlFor="sync-interval">Frequency</Label>
                  <Select id="sync-interval" value={String(prefs.syncIntervalMins)} onChange={(e) => savePrefs({ syncIntervalMins: Number(e.target.value) })}>
                    <option value="15">Every 15 minutes</option>
                    <option value="30">Every 30 minutes</option>
                    <option value="60">Every hour</option>
                    <option value="180">Every 3 hours</option>
                  </Select>
                  <p className="text-[11px] text-faint mt-1">Runs while the app is open.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Going live</h3>
            <p className="text-xs text-muted leading-relaxed">
              To connect a real Brightspace tenant: register an OAuth 2.0 app in Brightspace
              (Admin Tools → Manage Extensibility), then set <code className="font-mono">BRIGHTSPACE_MODE=live</code> and
              the <code className="font-mono">BRIGHTSPACE_*</code> variables in <code className="font-mono">.env</code>.
              Full instructions live in <code className="font-mono">docs/BRIGHTSPACE.md</code>. The UI and sync engine
              are unchanged between demo and live mode.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SyncLogRow({ log, expanded, onToggle }: { log: SyncLogDTO; expanded: boolean; onToggle: () => void }) {
  const details: SyncDetail[] = useMemo(() => {
    if (!log.details) return [];
    try { return JSON.parse(log.details) as SyncDetail[]; } catch { return []; }
  }, [log.details]);

  const ACTION_STYLE: Record<string, string> = {
    added: "text-emerald-600 dark:text-emerald-400",
    updated: "text-sky-600 dark:text-sky-400",
    removed: "text-rose-600 dark:text-rose-400",
    conflict: "text-amber-600 dark:text-amber-400",
  };

  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2" aria-expanded={expanded}>
        {log.status === "success" ? (
          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
        ) : log.status === "error" ? (
          <AlertTriangle size={15} className="text-rose-500 shrink-0" />
        ) : (
          <Spinner className="h-3.5 w-3.5" />
        )}
        <span className="min-w-0 grow">
          <span className="block text-[13px] font-medium">{fmtDate(log.startedAt, true)}</span>
          <span className="block text-xs text-muted">
            +{log.added} added · {log.updated} updated · {log.removed} removed{log.errors > 0 ? ` · ${log.errors} errors` : ""}
          </span>
        </span>
        {expanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
      </button>
      {expanded && details.length > 0 && (
        <div className="px-4 pb-3 ml-7">
          <ul className="space-y-0.5 max-h-64 overflow-y-auto">
            {details.map((d, i) => (
              <li key={i} className="text-xs flex items-center gap-2">
                <span className={cn("font-medium w-14 capitalize shrink-0", ACTION_STYLE[d.action] ?? "text-muted")}>{d.action}</span>
                <span className="text-muted w-24 shrink-0 capitalize">{d.entity}{d.field ? ` (${d.field})` : ""}</span>
                <span className="truncate">{d.label}</span>
                {d.courseCode && <span className="text-faint ml-auto shrink-0">{d.courseCode}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
