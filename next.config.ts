import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rgskspvuvzwmvmsccoez.supabase.co",
      },
      {
        // Supabase del Channel: las noticias migradas siguen sirviendo sus
        // imágenes desde su bucket `blog-images`. Solo lo público de Storage.
        protocol: "https",
        hostname: "yxqhtljhoceopnbcwdiy.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
