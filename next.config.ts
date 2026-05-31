import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rgskspvuvzwmvmsccoez.supabase.co",
      },
    ],
  },
};

export default nextConfig;
