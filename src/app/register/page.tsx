"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", inviteCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create your account.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white dark:text-zinc-900">
            <GraduationCap size={20} />
          </span>
          <span className="text-lg font-semibold tracking-tight">CampusHub</span>
        </div>
        <div className="rounded-2xl border border-border-base bg-surface p-6">
          <h1 className="text-base font-semibold mb-1">Create your account</h1>
          <p className="text-[13px] text-muted mb-5">You&apos;ll need an invite code from whoever runs this instance.</p>
          <form onSubmit={submit} className="space-y-3.5">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-[11px] text-faint mt-1">At least 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="invite">Invite code</Label>
              <Input id="invite" value={form.inviteCode} onChange={(e) => set("inviteCode", e.target.value)} required />
            </div>
            {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>
        <p className="text-center text-[13px] text-muted mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
