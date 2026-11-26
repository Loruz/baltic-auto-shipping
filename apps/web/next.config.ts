import type { NextConfig } from "next";

// One .env at the repo root serves every app (see .env.example).
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url).pathname);
} catch {
  // No root .env (CI, containers): variables come from the environment.
}

const config: NextConfig = {
  output: "standalone",
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    "@bas/auctions",
    "@bas/bidding",
    "@bas/billing",
    "@bas/config",
    "@bas/db",
    "@bas/i18n",
    "@bas/kyc",
    "@bas/notifications",
    "@bas/pricing",
    "@bas/search",
  ],
  turbopack: { root: new URL("../..", import.meta.url).pathname },
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  typedRoutes: true,
  async redirects() {
    return [{ source: "/", destination: "/lt", permanent: false }];
  },
};

export default config;
