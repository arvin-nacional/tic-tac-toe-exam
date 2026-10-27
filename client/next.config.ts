import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
    return [{ source: "/api/sessions", destination: `${apiBaseUrl}/api/sessions` }];
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
