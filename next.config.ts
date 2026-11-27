import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    const cdnPageCacheHeaders = [
      {
        key: "Vercel-CDN-Cache-Control",
        value: "public, s-maxage=60, stale-while-revalidate=300",
      },
    ];
    return [
      {
        source: "/",
        headers: cdnPageCacheHeaders,
      },
      {
        source: "/products/:slug",
        headers: cdnPageCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
