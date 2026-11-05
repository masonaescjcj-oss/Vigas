import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: ['@vigas/core', '@vigas/db', '@vigas/tokens', '@vigas/api-client'],
  // Import only the modules a file uses from the @vigas/core barrel (keeps zod out of client bundles).
  experimental: {
    optimizePackageImports: ['@vigas/core'],
  },
  cacheLife: {
    /** Public content (news, leaderboard, prices): served from cache, refreshed every few minutes. */
    content: { stale: 300, revalidate: 300, expire: 86_400 },
    /** Slower-moving catalogue data (tools directory). */
    catalog: { stale: 300, revalidate: 900, expire: 86_400 },
  },
};

export default nextConfig;
