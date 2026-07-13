import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/app/globals.css";
import "@/app/redesign.css";
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/layout/AppShell";
import { siteConfig } from "@/lib/site";
import { READING_SETTINGS_INIT_SCRIPT } from "@/lib/reading-settings";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { template: "%s | Verto", default: "Verto" },
  description:
    "The MDX reader — point it at a folder of .mdx / .md files, get a navigable, statically-rendered site.",
};

// The desktop shell adapts at phone widths; declare the viewport explicitly so
// fixed surfaces such as the Inbox reader sheet use the real device width.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const sans = localFont({
  src: "./fonts/inter-latin.woff2",
  display: "swap",
  variable: "--font-hanken",
  weight: "100 900",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  display: "swap",
  variable: "--font-jbmono",
  weight: "400 600",
});

const themeScript = `
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

const desktopTitlebarScript = `
  (function() {
    if (
      (window.__TAURI_INTERNALS__ || window.__TAURI__) &&
      /Windows/i.test(navigator.userAgent)
    ) {
      document.documentElement.classList.add('has-titlebar');
    }
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: desktopTitlebarScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: READING_SETTINGS_INIT_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
