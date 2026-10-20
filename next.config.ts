import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.155"],
  // Pin the workspace root to this folder. Without it, Next.js picks the
  // outermost lockfile it finds above the project (e.g. a stray
  // ~/package-lock.json) and Turbopack watches that whole directory tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
