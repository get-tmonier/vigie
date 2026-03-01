import type { KnipConfig } from "knip";

export default {
  workspaces: {
    ".": {},
    "packages/api": {
      project: ["src/**/*.ts"],
      ignoreDependencies: ["@tmonier/shared"],
    },
    "packages/ui": {
      entry: ["src/routes/**/*.tsx", "src/router.tsx"],
      project: ["src/**/*.{ts,tsx}"],
      ignoreDependencies: [
        "@tanstack/react-router-devtools",
        "@fontsource/jetbrains-mono",
        "@fontsource/source-serif-4",
        "@fontsource/vollkorn",
        "@fontsource/vollkorn-sc",
        "@tmonier/shared",
        "@tmonier/tokens",
        "tailwindcss",
      ],
      vite: { config: "vite.config.ts" },
    },
    "packages/landing": {
      entry: [
        "src/pages/**/*.astro",
        "src/layouts/**/*.astro",
        "src/components/**/*.astro",
        "scripts/*.mjs",
      ],
      project: ["src/**/*.{astro,ts,tsx}", "scripts/**/*.mjs"],
      ignoreDependencies: [
        "wrangler",
        "@astrojs/cloudflare",
        "@cloudflare/workers-types",
        "@fontsource/jetbrains-mono",
        "@fontsource/source-serif-4",
        "@fontsource/vollkorn",
        "@fontsource/vollkorn-sc",
        "@tmonier/tokens",
        "sharp",
        "tailwindcss",
      ],
    },
    "packages/shared": {
      project: ["src/**/*.ts"],
    },
    "packages/tokens": {
      project: ["**/*.ts"],
    },
  },
  ignore: [".ncurc.cjs"],
  ignoreWorkspaces: [],
} satisfies KnipConfig;
