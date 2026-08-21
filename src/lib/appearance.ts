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
] as const;

export const PRIORITY_SCHEMES = [
  { key: "classic", label: "Classic", hint: "Red · amber · grey" },
  { key: "colorblind", label: "Accessible", hint: "Blue · orange · grey, high contrast" },
  { key: "mono", label: "Monochrome", hint: "Weight shown by shade only" },
] as const;

export interface AppearanceState {
  theme: string;
  accent: string;
  /** Arbitrary hex color, used when accent === "custom". */
  customAccent: string | null;
  background: string;
  priorityScheme: string;
  density: string;
}

export const DEFAULT_APPEARANCE: AppearanceState = {
  theme: "system",
  accent: "indigo",
  customAccent: null,
  background: "plain",
  priorityScheme: "classic",
  density: "comfortable",
};

export interface ThemeVars {
  light: string; lightSoft: string; dark: string; darkSoft: string;
}

/** Derives the light/dark text pair for an arbitrary accent hex. */
export function accentVarsFromHex(hex: string): ThemeVars {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#4f46e5";
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  // A lighter tint for dark-mode text (keeps contrast against a dark surface).
  const lighten = (n: number) => Math.round(n + (255 - n) * 0.35);
  const dark = `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;

  return {
    light: clean,
    lightSoft: `rgba(${r}, ${g}, ${b}, 0.12)`,
    dark,
    darkSoft: `rgba(${lighten(r)}, ${lighten(g)}, ${lighten(b)}, 0.14)`,
  };
}

/** Full CSS var set for an accent: a preset's hand-picked dark-mode pair, or a derived one for a custom color. */
export function resolveThemeVars(accentKey: string, customAccent: string | null | undefined): ThemeVars {
  if (accentKey === "custom") {
    return accentVarsFromHex(customAccent ?? DEFAULT_APPEARANCE.customAccent ?? "#4f46e5");
  }
  const def = ACCENTS.find((x) => x.key === accentKey) ?? ACCENTS[0];
  return { light: def.light, lightSoft: def.lightSoft, dark: def.dark, darkSoft: def.darkSoft };
}

function applyThemeVars(root: HTMLElement, vars: ThemeVars) {
  root.style.setProperty("--accent-light", vars.light);
  root.style.setProperty("--accent-light-soft", vars.lightSoft);
  root.style.setProperty("--accent-dark", vars.dark);
  root.style.setProperty("--accent-dark-soft", vars.darkSoft);
}

/** Applies appearance to the document root; safe to call on every change. */
export function applyAppearance(a: Partial<AppearanceState>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (a.theme) {
    const dark = a.theme === "dark" || (a.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
  }
  if (a.accent) {
    root.dataset.accent = a.accent;
    applyThemeVars(root, resolveThemeVars(a.accent, a.customAccent));
  } else if (a.customAccent !== undefined && root.dataset.accent === "custom") {
    applyThemeVars(root, resolveThemeVars("custom", a.customAccent));
  }
  if (a.background) root.dataset.bg = a.background;
  if (a.priorityScheme) root.dataset.priority = a.priorityScheme;
  if (a.density) root.dataset.density = a.density;
}

/** Persisted locally so the pre-hydration script can restore it without a fetch. */
export const APPEARANCE_STORAGE_KEY = "campushub-appearance";
