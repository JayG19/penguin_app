/** Accent palettes, backgrounds and priority colour schemes. */

export interface AccentDef {
  key: string;
  label: string;
  /** light accent, light soft, dark accent, dark soft */
  light: string;
  lightSoft: string;
  dark: string;
  darkSoft: string;
  swatch: string;
}

export const ACCENTS: AccentDef[] = [
  { key: "indigo", label: "Indigo", light: "#4f46e5", lightSoft: "#eef2ff", dark: "#818cf8", darkSoft: "rgba(99,102,241,.14)", swatch: "#4f46e5" },
  { key: "violet", label: "Violet", light: "#7c3aed", lightSoft: "#f5f3ff", dark: "#a78bfa", darkSoft: "rgba(139,92,246,.14)", swatch: "#7c3aed" },
  { key: "emerald", label: "Emerald", light: "#059669", lightSoft: "#ecfdf5", dark: "#34d399", darkSoft: "rgba(16,185,129,.14)", swatch: "#059669" },
  { key: "sky", label: "Sky", light: "#0284c7", lightSoft: "#f0f9ff", dark: "#38bdf8", darkSoft: "rgba(14,165,233,.14)", swatch: "#0284c7" },
  { key: "amber", label: "Amber", light: "#d97706", lightSoft: "#fffbeb", dark: "#fbbf24", darkSoft: "rgba(245,158,11,.14)", swatch: "#d97706" },
  { key: "rose", label: "Rose", light: "#e11d48", lightSoft: "#fff1f2", dark: "#fb7185", darkSoft: "rgba(244,63,94,.14)", swatch: "#e11d48" },
  { key: "slate", label: "Graphite", light: "#334155", lightSoft: "#f1f5f9", dark: "#94a3b8", darkSoft: "rgba(148,163,184,.14)", swatch: "#334155" },
];

export const BACKGROUNDS = [
  { key: "plain", label: "Plain", hint: "Solid, distraction-free" },
  { key: "mesh", label: "Aurora", hint: "Soft accent gradient" },
  { key: "grid", label: "Grid", hint: "Subtle dotted grid" },
  { key: "glow", label: "Glow", hint: "Accent glow behind content" },
  { key: "custom", label: "Image", hint: "Your own image URL" },
] as const;

export const PRIORITY_SCHEMES = [
  { key: "classic", label: "Classic", hint: "Red · amber · grey" },
  { key: "colorblind", label: "Accessible", hint: "Blue · orange · grey, high contrast" },
  { key: "mono", label: "Monochrome", hint: "Weight shown by shade only" },
] as const;

export interface AppearanceState {
  theme: string;
  accent: string;
  background: string;
  backgroundUrl: string | null;
  priorityScheme: string;
  density: string;
}

export const DEFAULT_APPEARANCE: AppearanceState = {
  theme: "system",
  accent: "indigo",
  background: "plain",
  backgroundUrl: null,
  priorityScheme: "classic",
  density: "comfortable",
};

/** Applies appearance to the document root; safe to call on every change. */
export function applyAppearance(a: Partial<AppearanceState>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (a.theme) {
    const dark = a.theme === "dark" || (a.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
  }
  if (a.accent) {
    const def = ACCENTS.find((x) => x.key === a.accent) ?? ACCENTS[0];
    root.dataset.accent = def.key;
    root.style.setProperty("--accent-light", def.light);
    root.style.setProperty("--accent-light-soft", def.lightSoft);
    root.style.setProperty("--accent-dark", def.dark);
    root.style.setProperty("--accent-dark-soft", def.darkSoft);
  }
  if (a.background) root.dataset.bg = a.background;
  if (a.backgroundUrl !== undefined) {
    root.style.setProperty("--bg-image", a.backgroundUrl ? `url("${CSS.escape(a.backgroundUrl).replace(/\\/g, "")}")` : "none");
  }
  if (a.priorityScheme) root.dataset.priority = a.priorityScheme;
  if (a.density) root.dataset.density = a.density;
}

/** Persisted locally so the pre-hydration script can restore it without a fetch. */
export const APPEARANCE_STORAGE_KEY = "campushub-appearance";
