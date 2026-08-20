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
  /** Hand-picked complementary pair for the hero/nav-bar gradient — chosen
   * per preset rather than derived, since a blind hue rotation lands on a
   * harsh magenta or neon lime for some hues (green and blue accents,
   * especially). Custom colors fall back to a conservative algorithmic
   * derivation instead, since there's no hand-picked pair to reach for. */
  accent2: string;
  accent3: string;
}

export const ACCENTS: AccentDef[] = [
  { key: "indigo", label: "Indigo", light: "#4f46e5", lightSoft: "#eef2ff", dark: "#818cf8", darkSoft: "rgba(99,102,241,.14)", swatch: "#4f46e5", accent2: "#f59e0b", accent3: "#10b981" },
  { key: "violet", label: "Violet", light: "#7c3aed", lightSoft: "#f5f3ff", dark: "#a78bfa", darkSoft: "rgba(139,92,246,.14)", swatch: "#7c3aed", accent2: "#f59e0b", accent3: "#06b6d4" },
  { key: "emerald", label: "Emerald", light: "#059669", lightSoft: "#ecfdf5", dark: "#34d399", darkSoft: "rgba(16,185,129,.14)", swatch: "#059669", accent2: "#f59e0b", accent3: "#0ea5e9" },
  { key: "sky", label: "Sky", light: "#0284c7", lightSoft: "#f0f9ff", dark: "#38bdf8", darkSoft: "rgba(14,165,233,.14)", swatch: "#0284c7", accent2: "#8b5cf6", accent3: "#10b981" },
  { key: "amber", label: "Amber", light: "#d97706", lightSoft: "#fffbeb", dark: "#fbbf24", darkSoft: "rgba(245,158,11,.14)", swatch: "#d97706", accent2: "#f43f5e", accent3: "#10b981" },
  { key: "rose", label: "Rose", light: "#e11d48", lightSoft: "#fff1f2", dark: "#fb7185", darkSoft: "rgba(244,63,94,.14)", swatch: "#e11d48", accent2: "#f59e0b", accent3: "#8b5cf6" },
  { key: "slate", label: "Graphite", light: "#334155", lightSoft: "#f1f5f9", dark: "#94a3b8", darkSoft: "rgba(148,163,184,.14)", swatch: "#334155", accent2: "#8b85f0", accent3: "#94a3b8" },
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

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r0, g0, b0] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r0)}${toHex(g0)}${toHex(b0)}`;
}

export interface ThemeVars {
  light: string; lightSoft: string; dark: string; darkSoft: string;
  /** Two hues split-complementary to the accent, for gradient variety that stays harmonious with any accent — preset or custom. */
  accent2: string; accent3: string;
  /** A dark, desaturated shade of the accent's own hue — the nav bar's colour identity, independent of light/dark theme. */
  sidebarBg: string; sidebarBg2: string;
}

/** Derives the full set of CSS custom properties driven by one accent hex: light/dark text pair, two harmony hues for gradients, and the nav bar's own colour identity. */
export function accentVarsFromHex(hex: string): ThemeVars {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#4f46e5";
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  // A lighter tint for dark-mode text (keeps contrast against a dark surface).
  const lighten = (n: number) => Math.round(n + (255 - n) * 0.35);
  const dark = `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;

  const [h, s] = hexToHsl(clean);
  // Analogous, not complementary: a blind hue rotation at a fixed angle
  // lands on a harsh magenta or neon lime for some base hues (tried +140/
  // -85 — great on indigo, ugly on emerald and sky). Staying within a
  // narrow band of the input hue can't produce that kind of clash for any
  // input, which matters here since this runs on arbitrary user-picked
  // colors with no hand-picked fallback to reach for.
  const harmonySat = Math.min(70, Math.max(45, s));
  const accent2 = hslToHex(h + 28, harmonySat, 50);
  const accent3 = hslToHex(h - 28, harmonySat, 46);
  const sidebarSat = Math.min(55, Math.max(28, s * 0.75));
  const sidebarBg = hslToHex(h, sidebarSat, 13);
  const sidebarBg2 = hslToHex(h, sidebarSat, 19);

  return {
    light: clean,
    lightSoft: `rgba(${r}, ${g}, ${b}, 0.12)`,
    dark,
    darkSoft: `rgba(${lighten(r)}, ${lighten(g)}, ${lighten(b)}, 0.14)`,
    accent2, accent3, sidebarBg, sidebarBg2,
  };
}

/** Full CSS var set for an accent. A preset uses its hand-picked dark-mode
 * pair and gradient hues; only the nav bar's dark base is derived for it
 * (that one's safe to derive — it's just a dark, desaturated shade of the
 * accent's own hue, never a different hue). A custom color derives
 * everything, since there's no preset to fall back on. */
export function resolveThemeVars(accentKey: string, customAccent: string | null | undefined): ThemeVars {
  if (accentKey === "custom") {
    return accentVarsFromHex(customAccent ?? DEFAULT_APPEARANCE.customAccent ?? "#4f46e5");
  }
  const def = ACCENTS.find((x) => x.key === accentKey) ?? ACCENTS[0];
  const derived = accentVarsFromHex(def.light);
  return {
    ...derived,
    light: def.light, lightSoft: def.lightSoft, dark: def.dark, darkSoft: def.darkSoft,
    accent2: def.accent2, accent3: def.accent3,
  };
}

function applyThemeVars(root: HTMLElement, vars: ThemeVars) {
  root.style.setProperty("--accent-light", vars.light);
  root.style.setProperty("--accent-light-soft", vars.lightSoft);
  root.style.setProperty("--accent-dark", vars.dark);
  root.style.setProperty("--accent-dark-soft", vars.darkSoft);
  root.style.setProperty("--accent-2", vars.accent2);
  root.style.setProperty("--accent-3", vars.accent3);
  root.style.setProperty("--sidebar-bg", vars.sidebarBg);
  root.style.setProperty("--sidebar-bg-2", vars.sidebarBg2);
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
