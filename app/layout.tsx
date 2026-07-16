import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "@/app/globals.css";
import "@/app/redesign.css";
import "@/app/polish.css";
import "@/app/codex-clone.css";
import "@/app/codex-desktop.css";
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/sonner";
import NativeLocalFolderReconciler from "@/components/state/NativeLocalFolderReconciler";
import StateStoreErrorNotifier from "@/components/state/StateStoreErrorNotifier";
import AppShell from "@/components/layout/AppShell";
import { siteConfig } from "@/lib/site";
import { READING_SETTINGS_INIT_SCRIPT } from "@/lib/reading-settings";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { template: "%s | Verto", default: "Verto" },
  description:
    "Point the MDX reader at a folder of .mdx or .md files to get a navigable, statically rendered site.",
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
  variable: "--font-inter",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <Script id="verto-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Script id="verto-reading-settings" strategy="beforeInteractive">
          {READING_SETTINGS_INIT_SCRIPT}
        </Script>
      </head>
      <body>
        <NativeLocalFolderReconciler />
        <StateStoreErrorNotifier />
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
