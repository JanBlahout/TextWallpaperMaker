import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export only: the app is a browser-only editor with no server code.
  output: "export",
};

export default nextConfig;
