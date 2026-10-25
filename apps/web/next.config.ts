import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  transpilePackages: ["@formaproof/contracts", "@formaproof/engineering", "@formaproof/sdk"],
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  turbopack: { root: path.resolve(process.cwd(), "../..") },
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingExcludes: {
    "/api/**": ["./.data/**/*", "**/private-files/**/*", "**/patentradar.sqlite*"],
  },
  outputFileTracingIncludes: {
    "/api/v1/guide": ["./docs/API_MCP.md"],
    "/api/cad/*": ["./cad/worker.py"],
    "/api/v1/cad/*": ["./cad/worker.py"],
    "/api/cad/interpret": ["../../node_modules/pdfjs-dist/legacy/build/*.mjs"],
    "/api/extract": ["../../node_modules/pdfjs-dist/legacy/build/*.mjs"],
    "/api/spot": ["../../node_modules/pdfjs-dist/legacy/build/*.mjs"],
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
