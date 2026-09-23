// Next.js configuration. The answers route reads prompts/probe-*.md at run time,
// so those files must travel with that route when it is deployed.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/responses/\\[id\\]/answers": ["./prompts/probe-*.md"],
  },
};

export default nextConfig;
