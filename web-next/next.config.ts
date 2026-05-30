import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'manchq.com',
      },
    ],
  },
  // Clean-URL alias so /why-manchq serves the standalone marketing
  // HTML in public/why-manchq.html (linked from the landing page's
  // "why us" section as a "read all 10 reasons" follow-on). The
  // .html file is also reachable directly — this rewrite just gives
  // it a prettier URL for sharing.
  async rewrites() {
    return [
      {
        source: '/why-manchq',
        destination: '/why-manchq.html',
      },
    ];
  },
};

export default nextConfig;
