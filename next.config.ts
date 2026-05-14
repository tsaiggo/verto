import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) needs explicit transpile for next-mdx-remote ESM
  transpilePackages: ['next-mdx-remote'],

  // Legacy redirects: the old docs/blog routes now live under /read, but
  // we preserve the `docs/` and `blog/` directory prefixes from `content/`.
  async redirects() {
    return [
      { source: '/docs', destination: '/read/docs', permanent: true },
      { source: '/docs/:path*', destination: '/read/docs/:path*', permanent: true },
      { source: '/blog', destination: '/read/blog', permanent: true },
      { source: '/blog/:path*', destination: '/read/blog/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
