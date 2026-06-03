import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import '@/app/globals.css';
import 'katex/dist/katex.min.css';
import { Toaster } from '@/components/ui/sonner';
import AppShell from '@/components/layout/AppShell';
import { siteConfig } from '@/lib/site';
import { READING_SETTINGS_INIT_SCRIPT } from '@/lib/reading-settings';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { template: '%s | Verto', default: 'Verto' },
  description: 'The MDX reader — point it at a folder of .mdx / .md files, get a navigable, statically-rendered site.',
};

const themeScript = `
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

// Marks the document for the Windows Mica backdrop before first paint, so the
// app's base surfaces render translucent (see `html.mica` in globals.css) and
// the native material shows through — instead of a solid white flash. Scoped to
// the desktop shell (Tauri) on Windows; the web build and other platforms are
// untouched. Mica itself is enabled via `windowEffects` in tauri.conf.json.
const micaScript = `
  (function() {
    try {
      var w = window;
      var isTauri = !!(w.__TAURI_INTERNALS__ || w.__TAURI__);
      if (isTauri && /Windows/i.test(navigator.userAgent)) {
        document.documentElement.classList.add('mica');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: micaScript }} />
        <script
          dangerouslySetInnerHTML={{ __html: READING_SETTINGS_INIT_SCRIPT }}
        />
      </head>
      <body className={jetbrainsMono.variable}>
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
