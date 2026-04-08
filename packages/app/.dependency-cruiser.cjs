/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-domain-imports-shell',
      comment: 'agent-session domain module must not import from the application shell.',
      severity: 'error',
      from: {
        path: '^src/modules/',
      },
      to: {
        path: '^src/shell/',
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
