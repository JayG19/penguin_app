"use client";

import { useEffect } from "react";
import { ACCENTS, APPEARANCE_STORAGE_KEY, applyAppearance, type AppearanceState } from "@/lib/appearance";

/**
 * Mirrors the server-side appearance preference into the DOM and localStorage,
 * so the pre-hydration script in the root layout can restore it instantly on
 * the next page load (no flash of the wrong accent/background).
 */
export function AppearanceProvider({ appearance }: { appearance: AppearanceState }) {
  useEffect(() => {
    applyAppearance(appearance);
    const def = ACCENTS.find((a) => a.key === appearance.accent) ?? ACCENTS[0];
    try {
      localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        JSON.stringify({
          ...appearance,
          vars: { light: def.light, lightSoft: def.lightSoft, dark: def.dark, darkSoft: def.darkSoft },
        }),
      );
      localStorage.setItem("campushub-theme", appearance.theme);
    } catch {}
  }, [appearance]);

  useEffect(() => {
    if (appearance.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance({ theme: "system" });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance.theme]);

  return null;
}
