import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*", "10.51.60.220", "localhost", "127.0.0.1"],
};

export default nextConfig;