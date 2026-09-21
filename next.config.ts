import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["cheerio"],
  async redirects() {
    return [{ source: "/saved", destination: "/", permanent: false }];
  },
};

export default nextConfig;
