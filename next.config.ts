import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Posters are served as plain <img> from TMDB / Vercel Blob, so next/image
  // optimization (and its Hobby-tier transform quota) is intentionally unused.
  images: { unoptimized: true },
  serverExternalPackages: ['bcryptjs'],
};

export default nextConfig;
