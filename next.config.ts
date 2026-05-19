import type { NextConfig } from 'next';

// When building for the Tauri desktop app we need a fully static export
// (Tauri loads files from disk, there is no Node server). `redirects()`
// and `next/image`'s default loader aren't supported in export mode, so
// they're gated on the same flag — the web build is unaffected.
const isTauri = process.env.TAURI === '1';

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) needs explicit transpile for next-mdx-remote ESM
  transpilePackages: ['next-mdx-remote'],

  ...(isTauri
    ? {
        output: 'export' as const,
        images: { unoptimized: true },
        // Tauri serves the bundle from a custom asset protocol, so use
        // relative URLs for static assets.
        assetPrefix: './',
      }
    : {
        // Legacy redirects: the old docs/blog routes now live under
        // /read, but we preserve the `docs/` and `blog/` directory
        // prefixes from `content/`. Static export (Tauri build) cannot
        // emit redirects, so they're skipped there.
        async redirects() {
          return [
            { source: '/docs/:path*', destination: '/read/docs/:path*', permanent: true },
            { source: '/blog/:path*', destination: '/read/blog/:path*', permanent: true },
          ];
        },
      }),
};

export default nextConfig;
