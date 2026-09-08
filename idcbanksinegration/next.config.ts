import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ['sequelize', 'sequelize-typescript', 'mysql2', 'tedious', 'bcrypt'],
  outputFileTracingRoot: path.join(__dirname, '..'),
  turbopack: { root: path.join(__dirname, '..') },
  allowedDevOrigins: ["*", "10.51.60.220", "localhost", "127.0.0.1"],
};

export default nextConfig;
