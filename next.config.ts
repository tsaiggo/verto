import type { NextConfig } from "next";

// When building for the Tauri desktop app we need a fully static export
// (Tauri loads files from disk, there is no Node server). `redirects()`
// and `next/image`'s default loader aren't supported in export mode, so
// they're gated on the same flag — the web build is unaffected.
const isTauri = process.env.TAURI === "1";

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) needs explicit transpile for next-mdx-remote ESM
  transpilePackages: ["next-mdx-remote"],
  // Scope Turbopack to the directory from which this project is invoked.
  turbopack: { root: process.cwd() },
  ...(isTauri
    ? {
        output: "export" as const,
        images: { unoptimized: true },
      }
    : {
        // Legacy redirects. The built-in docs are now the standalone Help
        // section, so /docs/* (and the short-lived /read/docs/* aliases)
        // redirect to /help. Paths changed during the docs reorg + merge,
        // so these land on the Help home rather than attempting a 1:1 slug
        // mapping. The blog still lives under /read/blog/*. Static export
        // (Tauri build) cannot emit redirects, so they're skipped there.
        async redirects() {
          return [
            { source: "/docs/:path*", destination: "/help", permanent: true },
            { source: "/read/docs/:path*", destination: "/help", permanent: true },
            { source: "/blog/:path*", destination: "/read/blog/:path*", permanent: true },
          ];
        },
      }),
};

export default nextConfig;
