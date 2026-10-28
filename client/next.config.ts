import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_E2E === "1" ? ".next-e2e" : ".next",
  async rewrites() {
    const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
    return [{ source: "/api/sessions/:path*", destination: `${apiBaseUrl}/api/sessions/:path*` }];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
