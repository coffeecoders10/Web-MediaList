import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  basePath: "/the-archive",
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;