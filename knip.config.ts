import type { KnipConfig } from 'knip';

export default {
  ignoreDependencies: ['bun-types'],
  project: ['src/**/*.ts'],
} satisfies KnipConfig;
