import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["cheerio"],
  async redirects() {
    return [
      { source: "/dancers", destination: "/kids", permanent: false },
      { source: "/dancers/:id", destination: "/kids/:id", permanent: false },
    ];
  },
};

export default nextConfig;
