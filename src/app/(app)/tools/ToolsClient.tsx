"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, GripVertical, Pin, Plus, Trash2, Wrench } from "lucide-react";
import { Button, Card, EmptyState, Input, Label, Modal, toast } from "@/components/ui";
import { TOOL_ICONS } from "@/components/tool-icons";
import type { ToolDTO } from "@/components/types";
import { cn } from "@/lib/utils";

export function ToolsClient({ tools: initial }: { tools: ToolDTO[] }) {
  const router = useRouter();
  const [tools, setTools] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", url: "" });
  const [dragId, setDragId] = useState<string | null>(null);

  async function persistOrder(next: ToolDTO[]) {
    setTools(next);
    await fetch("/api/tools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((t) => t.id) }),
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = [...tools];
    const from = next.findIndex((t) => t.id === dragId);
    const to = next.findIndex((t) => t.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
    setDragId(null);
  }

  async function togglePin(t: ToolDTO) {
    const res = await fetch(`/api/tools/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !t.pinned }) });
    if (res.ok) {
      setTools((prev) => prev.map((x) => (x.id === t.id ? { ...x, pinned: !t.pinned } : x)));
      toast(t.pinned ? "Unpinned from dashboard" : "Pinned to dashboard");
      router.refresh();
    }
  }

  async function remove(t: ToolDTO) {
    if (!confirm(`Remove "${t.name}"?`)) return;
    await fetch(`/api/tools/${t.id}`, { method: "DELETE" });
    setTools((prev) => prev.filter((x) => x.id !== t.id));
    toast("Tool removed");
  }

  async function add() {
    if (!form.name.trim() || !form.url.trim()) return;
    let url = form.url.trim();
    if (!/^https?:\/\//.test(url)) url = `https://${url}`;
    const res = await fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, url }) });
    if (res.ok) {
      const t = (await res.json()).tool;
      setTools((prev) => [...prev, t]);
      setAdding(false);
      setForm({ name: "", url: "" });
      toast("Tool added");
    } else {
      toast("Enter a valid URL", "error");
    }
  }

  const pinned = tools.filter((t) => t.pinned);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Useful Tools</h1>
          <p className="text-[13px] text-muted">
            {pinned.length} pinned to dashboard · drag to reorder · tools open in a new tab
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={14} /> Add Tool</Button>
      </div>

      {tools.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench size={28} />}
            title="No tools yet"
            hint="Add quick links to the apps you use every day."
            actions={<Button size="sm" variant="outline" onClick={() => setAdding(true)}>Add Tool</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {tools.map((t) => {
            const Icon = TOOL_ICONS[t.icon] ?? ArrowUpRight;
            return (
              <div
                key={t.id}
                draggable
                onDragStart={() => setDragId(t.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(t.id)}
                className="group relative rounded-xl border border-border-base bg-surface p-4 hover:border-border-strong transition-colors cursor-grab active:cursor-grabbing"
              >
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2">
                  <Icon size={22} className="text-muted group-hover:text-accent transition-colors" />
                  <span className="text-[13px] font-medium text-center truncate max-w-full">{t.name}</span>
                </a>
                <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={() => togglePin(t)}
                    className={cn("p-1 rounded-md hover:bg-surface-2", t.pinned ? "text-accent" : "text-faint")}
                    aria-label={t.pinned ? `Unpin ${t.name}` : `Pin ${t.name}`}
                  >
                    <Pin size={12} />
                  </button>
                  <button onClick={() => remove(t)} className="p-1 rounded-md hover:bg-surface-2 text-faint hover:text-rose-500" aria-label={`Remove ${t.name}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <span className="absolute top-1.5 left-1.5 text-faint opacity-0 group-hover:opacity-100" aria-hidden>
                  <GripVertical size={12} />
                </span>
                {t.pinned && <span className="absolute bottom-1.5 right-1.5 text-accent" aria-label="Pinned"><Pin size={10} /></span>}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add tool">
        <form className="space-y-3.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <div>
            <Label htmlFor="tool-name">Name</Label>
            <Input id="tool-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Overleaf" required autoFocus />
          </div>
          <div>
            <Label htmlFor="tool-url">URL</Label>
            <Input id="tool-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://overleaf.com" required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Add Tool</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
