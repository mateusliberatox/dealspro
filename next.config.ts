import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: '*.aliyuncs.com' },
      { hostname: '*.alicdn.com' },
      { hostname: '*.geilicdn.com' },
      { hostname: 'cdn.discordapp.com' },
    ],
  },
};

export default nextConfig;
