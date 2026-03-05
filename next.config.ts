import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No mdxRs — we use custom JS remark/rehype plugins
  // No Turbopack — incompatible with local remark/rehype plugins
};

export default nextConfig;
