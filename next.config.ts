import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'cssdeals.oss-us-west-1.aliyuncs.com' },
      { hostname: 'cbu01.alicdn.com' },
      { hostname: 'img.alicdn.com' },
      { hostname: 'si.geilicdn.com' },
      { hostname: 'cdn.discordapp.com' },
    ],
  },
};

export default nextConfig;
