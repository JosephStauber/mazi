import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Avatars are served from Convex file storage. (Post images go through
    // /api/images and are rendered unoptimized, since access is per-viewer.)
    remotePatterns: [
      { protocol: "https", hostname: "**.convex.cloud" },
      // Local `npx convex dev` backend.
      { protocol: "http", hostname: "127.0.0.1", port: "3210" },
    ],
  },
};

export default nextConfig;
