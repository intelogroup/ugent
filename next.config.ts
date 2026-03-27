import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.githubusercontent.com',
        pathname: '/media/intelogroup/ugent/main/public/extracted_images/images/**',
      },
    ],
  },
};

export default nextConfig;
