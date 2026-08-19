import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "CampusHub", template: "%s · CampusHub" },
  description: "Your academic workspace — courses, deadlines, grades and Brightspace sync in one place.",
};

const themeInit = `
(function () {
  try {
    var raw = localStorage.getItem("campushub-appearance");
    var a = raw ? JSON.parse(raw) : {};
    var t = a.theme || localStorage.getItem("campushub-theme") || "system";
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var el = document.documentElement;
    if (dark) el.classList.add("dark");
    if (a.accent) {
      el.dataset.accent = a.accent;
      if (a.vars) {
        el.style.setProperty("--accent-light", a.vars.light);
        el.style.setProperty("--accent-light-soft", a.vars.lightSoft);
        el.style.setProperty("--accent-dark", a.vars.dark);
        el.style.setProperty("--accent-dark-soft", a.vars.darkSoft);
      }
    }
    if (a.background) el.dataset.bg = a.background;
    if (a.priorityScheme) el.dataset.priority = a.priorityScheme;
    if (a.density) el.dataset.density = a.density;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
