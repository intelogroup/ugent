import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Local images in public/ are optimized by default.
    // We can adjust deviceSizes or imageSizes if needed for the 2,000+ images,
    // but the defaults are generally good for performance.
    minimumCacheTTL: 60,
  },
};

export default nextConfig;
