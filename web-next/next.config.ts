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
  // Clean-URL alias so /advertise serves the standalone marketing
  // HTML in public/advertise.html (single self-contained page, not
  // linked from anywhere in the app). The .html file is also
  // reachable directly at /advertise.html — this rewrite just gives
  // it a prettier URL for sharing.
  async rewrites() {
    return [
      {
        source: '/advertise',
        destination: '/advertise.html',
      },
    ];
  },
};

export default nextConfig;
