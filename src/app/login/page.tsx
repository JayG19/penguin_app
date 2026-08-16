"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@student.app");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
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
          <h1 className="text-base font-semibold mb-1">Welcome back</h1>
          <p className="text-[13px] text-muted mb-5">Sign in to your academic workspace.</p>
          <form onSubmit={submit} className="space-y-3.5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-faint mt-4">
          Demo account: <span className="font-mono">demo@student.app</span> / <span className="font-mono">demo1234</span>
        </p>
      </div>
    </main>
  );
}
