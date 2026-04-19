import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Workaround Next 16 / Turbopack : sans root explicite, la résolution CSS de
// `@import "tailwindcss"` part du dossier parent et ne trouve pas le package.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
