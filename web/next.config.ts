import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/national": ["./data/national/published/**/*"],
  },
};

export default nextConfig;
