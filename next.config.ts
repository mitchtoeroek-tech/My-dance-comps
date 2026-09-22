import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["cheerio"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/studio-logos/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/saved", destination: "/", permanent: false },
      { source: "/calendar", destination: "/my-comps", permanent: false },
      { source: "/dancers", destination: "/kids", permanent: false },
      { source: "/dancers/:id", destination: "/kids/:id", permanent: false },
    ];
  },
};

export default nextConfig;
