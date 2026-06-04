import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [ '*','10.51.60.220', 'localhost', '127.0.0.1'],
  // You can also use wildcards if needed:
  // allowedDevOrigins: ['*.your-domain.com', '10.51.60.*'],
};

export default nextConfig;