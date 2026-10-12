import type { NextConfig } from "next";

const basePath = "/the-archive";

const nextConfig: NextConfig = {
  /* config options here */
  basePath,
  // Plain fetch() calls aren't prefixed with basePath automatically, so the client needs it too.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;