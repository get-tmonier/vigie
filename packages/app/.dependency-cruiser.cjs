/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-imports',
      comment:
        'Modules must not import from each other. Only dependencies.ts files may cross module boundaries.',
      severity: 'error',
      from: {
        path: '^src/modules/([^/]+)/',
        pathNot: [
          '^src/modules/[^/]+/dependencies\\.ts$',
          '^src/modules/[^/]+/infrastructure/adapters/in/ui/.*',
        ],
      },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'no-shared-kernel-imports-modules',
      comment: 'Shared kernel must not import from any module.',
      severity: 'error',
      from: {
        path: '^src/shared/',
        pathNot: '^src/shared/ssr/client-entry\\.tsx$',
      },
      to: {
        path: '^src/modules/',
      },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
