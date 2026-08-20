"use client";

import { cn } from "@/lib/utils";
import { SlidersHorizontal, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "xs";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "xs" && "h-7 px-2.5 text-xs",
        variant === "primary" && "bg-accent text-white hover:opacity-90 dark:text-zinc-900",
        variant === "secondary" && "bg-surface-2 text-foreground hover:bg-border-base/70 border border-border-base",
        variant === "outline" && "border border-border-base bg-transparent hover:bg-surface-2",
        variant === "ghost" && "bg-transparent hover:bg-surface-2 text-muted hover:text-foreground",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-500",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Card ---------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border-base bg-surface", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between px-4 pt-3.5 pb-2", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  // "none" opts out of the tone's own bg/text classes for badges that pass
  // their own color via className (e.g. per-course colors) — without it,
  // the tone's classes and the custom className fight over the same CSS
  // property with equal specificity, and the winner is decided by Tailwind's
  // generated rule order rather than JSX class order, so it silently
  // "worked" for some colors and not others (e.g. some course tags
  // rendering without their color).
  tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet" | "accent" | "none";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone === "neutral" && "bg-surface-2 text-muted border border-border-base",
        tone === "green" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tone === "amber" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        tone === "red" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        tone === "blue" && "bg-sky-500/10 text-sky-600 dark:text-sky-400",
        tone === "violet" && "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        tone === "accent" && "bg-accent-soft text-accent",
        className,
      )}
      {...props}
    />
  );
}

export function SourceBadge({ source }: { source: string }) {
  return source === "brightspace" ? (
    <Badge tone="accent" title="Synced from Brightspace">Brightspace</Badge>
  ) : (
    <Badge tone="neutral" title="Manually added">Manual</Badge>
  );
}

export function PriorityBadge({ priority, overridden }: { priority: string; overridden?: boolean }) {
  const label =
    priority === "review" ? "Final check" : priority === "done" ? "Done" : priority;
  const title =
    priority === "review"
      ? "Work is finished — needs a final check before submitting"
      : priority === "done"
        ? "Submitted or completed"
        : overridden
          ? "Priority set manually"
          : "Priority computed from weight & deadline";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap",
        `prio-${priority}`,
      )}
      title={title}
    >
      {label}
      {overridden && priority !== "done" && priority !== "review" ? " •" : ""}
    </span>
  );
}

/* ---------- Form controls ---------- */

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[13px] font-medium text-muted mb-1", className)} {...props} />;
}

/** Browsers let a scroll over a focused number/date/time input silently change its
 * value — surprising when the user is just scrolling the page. Blurring on wheel
 * makes the scroll fall through to the page instead, like every other input. */
const SCROLLABLE_TYPES = new Set(["number", "date", "time", "datetime-local", "month", "week"]);

export function Input({ className, onWheel, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      onWheel={(e) => {
        onWheel?.(e);
        if (type && SCROLLABLE_TYPES.has(type)) e.currentTarget.blur();
      }}
      className={cn(
        "w-full h-9 rounded-lg border border-border-base bg-surface px-3 text-sm placeholder:text-faint focus:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-sm placeholder:text-faint focus:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-border-base bg-surface px-2.5 text-sm focus:border-border-strong",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "bg-border-strong",
      )}
      style={{ width: 40, height: 22, padding: 0 }}
    >
      <span
        className="absolute rounded-full bg-white shadow-sm transition-[left] duration-150"
        style={{ width: 18, height: 18, top: 2, left: checked ? 20 : 2 }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg border border-border-base bg-surface-2 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "md" ? "px-3 h-7.5 text-[13px]" : "px-2.5 h-6.5 text-xs",
            value === o.value ? "bg-surface text-foreground shadow-sm border border-border-base" : "text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Checkbox ---------- */

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      className={cn("h-4 w-4 rounded border-border-strong accent-[var(--accent)] cursor-pointer", className)}
    />
  );
}

/* ---------- Filter menu ---------- */

export interface FilterGroup<T extends string = string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** Value that counts as "no filter applied". */
  allValue: T;
}

/**
 * One control standing in for several selects: a button that opens a popover
 * with each group, and shows how many filters are currently narrowing results.
 */
export function FilterMenu({ groups, className }: { groups: FilterGroup[]; className?: string }) {
  const active = groups.filter((g) => g.value !== g.allValue);
  return (
    <Menu
      align="left"
      trigger={
        <Button size="sm" variant={active.length ? "primary" : "outline"} className={className}>
          <SlidersHorizontal size={13} />
          Filter
          {active.length > 0 && (
            <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-[10px] font-semibold tabular-nums">
              {active.length}
            </span>
          )}
        </Button>
      }
    >
      <div className="w-60 p-1">
        {groups.map((g) => (
          <div key={g.id} className="px-2 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">{g.label}</p>
            <select
              value={g.value}
              onChange={(e) => g.onChange(e.target.value)}
              className="h-8 w-full rounded-lg border border-border-base bg-surface px-2 text-[13px]"
              aria-label={g.label}
            >
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
        {active.length > 0 && (
          <div className="border-t border-border-base mt-1 pt-1">
            <button
              onClick={() => groups.forEach((g) => g.onChange(g.allValue))}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-muted hover:bg-surface-2 hover:text-foreground rounded-md"
            >
              <X size={13} /> Clear filters
            </button>
          </div>
        )}
      </div>
    </Menu>
  );
}

/* ---------- Progress ---------- */

export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-surface-2 overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-accent transition-all", barClassName)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  title,
  hint,
  actions,
  icon,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
      {icon && <div className="text-faint mb-1">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-[13px] text-muted max-w-xs">{hint}</p>}
      {actions && <div className="flex gap-2 mt-2 flex-wrap justify-center">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-accent",
        className,
      )}
      aria-label="Loading"
    />
  );
}

/* ---------- Modal / Drawer ---------- */

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const mounted = useMounted();
  if (!open || !mounted) return null;
  return createPortal(
    <Overlay onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute left-1/2 top-[8vh] -translate-x-1/2 w-[calc(100vw-2rem)] rounded-xl border border-border-base bg-surface shadow-2xl max-h-[84vh] overflow-y-auto",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border-base px-4 py-3 sticky top-0 bg-surface z-10 rounded-t-xl">
            <h2 className="text-sm font-semibold">{title}</h2>
            <button onClick={onClose} className="text-muted hover:text-foreground p-1 -m-1" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </Overlay>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  const mounted = useMounted();
  if (!open || !mounted) return null;
  return createPortal(
    <Overlay onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-surface border-l border-border-base shadow-2xl flex flex-col animate-[slidein_.18s_ease-out]"
        style={{ animationName: "none" }}
      >
        <div className="flex items-center justify-between border-b border-border-base px-4 py-3 shrink-0">
          <div className="text-sm font-semibold min-w-0 truncate">{title}</div>
          <button onClick={onClose} className="text-muted hover:text-foreground p-1 -m-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 grow">{children}</div>
      </div>
    </Overlay>,
    document.body,
  );
}

/* ---------- Dropdown menu ---------- */

const MenuCtx = createContext<{ close: () => void } | null>(null);

export function Menu({ trigger, children, align = "right" }: { trigger: ReactNode; children: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <MenuCtx.Provider value={{ close: () => setOpen(false) }}>
          <div
            role="menu"
            className={cn(
              "absolute z-40 mt-1 min-w-44 rounded-lg border border-border-base bg-surface shadow-xl py-1",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {children}
          </div>
        </MenuCtx.Provider>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick?: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  const ctx = useContext(MenuCtx);
  return (
    <button
      role="menuitem"
      onClick={() => {
        ctx?.close();
        onClick?.();
      }}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-left hover:bg-surface-2",
        danger ? "text-rose-600 dark:text-rose-400" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Toast ---------- */

type Toast = { id: number; message: string; tone: "default" | "error" };
const listeners = new Set<(t: Toast) => void>();
let toastId = 0;

export function toast(message: string, tone: "default" | "error" = "default") {
  const t = { id: ++toastId, message, tone };
  listeners.forEach((l) => l(t));
}

const TOAST_DURATION_MS = 3000;

export function Toaster() {
  // Only ever one toast on screen: a new one replaces whatever's showing,
  // instead of stacking up when several changes save in quick succession.
  const [current, setCurrent] = useState<Toast | null>(null);
  useEffect(() => {
    const l = (t: Toast) => {
      setCurrent(t);
      setTimeout(() => setCurrent((prev) => (prev?.id === t.id ? null : prev)), TOAST_DURATION_MS);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 items-center pointer-events-none" aria-live="polite">
      {current && (
        <div
          key={current.id}
          className={cn(
            "rounded-lg border px-3.5 py-2 text-[13px] shadow-lg bg-surface",
            current.tone === "error" ? "border-rose-500/40 text-rose-600 dark:text-rose-400" : "border-border-base",
          )}
        >
          {current.message}
        </div>
      )}
    </div>
  );
}
