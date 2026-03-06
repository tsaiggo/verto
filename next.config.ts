import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) needs explicit transpile for next-mdx-remote ESM
  transpilePackages: ['next-mdx-remote'],
};

export default nextConfig;
