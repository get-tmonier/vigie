import type { KnipConfig } from 'knip';

export default {
  workspaces: {
    '.': {},
    'packages/landing': {
      entry: ['src/pages/**/*.astro', 'src/layouts/**/*.astro', 'src/components/**/*.astro'],
      project: ['src/**/*.{astro,ts,tsx}'],
      ignoreDependencies: [
        '@fontsource-variable/dm-sans',
        '@fontsource/instrument-serif',
        '@fontsource/jetbrains-mono',
        'tailwindcss',
      ],
    },
    'packages/app': {
      entry: ['src/infra/ssr/client-entry.tsx', 'src/daemon.ts'],
      project: ['src/**/*.{ts,tsx}'],
      ignoreDependencies: [
        '@fontsource-variable/dm-sans',
        '@fontsource/instrument-serif',
        '@fontsource/jetbrains-mono',
        '@vigie/tokens',
        'tailwindcss',
      ],
      vite: { config: 'vite.config.ts' },
    },
    'packages/tokens': {
      project: ['**/*.ts'],
    },
  },
  ignore: ['.ncurc.cjs'],
  ignoreExportsUsedInFile: false,
  ignoreWorkspaces: ['packages/video'],
} satisfies KnipConfig;
