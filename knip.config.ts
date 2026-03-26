import type { KnipConfig } from 'knip';

export default {
  workspaces: {
    '.': {},
    'packages/api': {
      project: ['src/**/*.ts'],
    },
    'packages/ui': {
      entry: ['src/routes/**/*.tsx', 'src/router.tsx'],
      project: ['src/**/*.{ts,tsx}'],
      ignoreDependencies: [
        '@tanstack/react-router-devtools',
        '@fontsource/jetbrains-mono',
        '@fontsource/source-serif-4',
        '@fontsource/vollkorn',
        '@fontsource/vollkorn-sc',
        '@vigie/tokens',
        'tailwindcss',
      ],
      vite: { config: 'vite.config.ts' },
    },
    'packages/vigie-landing': {
      entry: ['src/pages/**/*.astro', 'src/layouts/**/*.astro', 'src/components/**/*.astro'],
      project: ['src/**/*.{astro,ts,tsx}'],
      ignoreDependencies: [
        '@fontsource/bitter',
        '@fontsource/jetbrains-mono',
        '@fontsource/source-serif-4',
        '@fontsource/vollkorn',
        '@fontsource/vollkorn-sc',
        '@vigie/tokens',
        'tailwindcss',
      ],
    },
    'packages/shared': {
      project: ['src/**/*.ts'],
    },
    'packages/tokens': {
      project: ['**/*.ts'],
    },
  },
  ignore: ['.ncurc.cjs'],
  ignoreExportsUsedInFile: false,
  ignoreWorkspaces: [],
} satisfies KnipConfig;
