import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The shared package ships TypeScript source.
  transpilePackages: ['@theshire/shared'],
  // Proxy /api/* to the Fastify service so the browser stays same-origin (needed for cookies later).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
