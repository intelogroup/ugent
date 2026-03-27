import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (!dev) {
      // Disable SWC minification — Next.js 15.x webpack workers lack webpack.init(),
      // causing `_webpack.WebpackError is not a constructor` crashes.
      config.optimization.minimize = false;
    }
    return config;
  },
  images: {
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/intelogroup/ugent/main/public/extracted_images/images/**',
      },
    ],
  },
};

export default nextConfig;
