/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Cross-module boundaries ────────────────────────────────────────────────
    //
    // Three modules: daemon / session / terminal.
    // Cross-module imports are forbidden except in the daemon composition root
    // (main.ts and infrastructure/layers.ts), which is responsible for wiring
    // all layers together via Effect Layers.
    //
    // Shared types (IPC protocol, domain events, errors) must live in
    // #shared/kernel/* — never be re-imported across module boundaries.

    {
      name: 'no-daemon-imports-session',
      comment:
        'daemon must not import from session. Move shared types to #shared/kernel/* or introduce a SessionCommandShape port in daemon.',
      severity: 'error',
      from: {
        path: '^src/modules/daemon',
        pathNot: '^src/modules/daemon/(main|infrastructure/layers)\\.ts$',
      },
      to: { path: '^src/modules/session' },
    },
    {
      name: 'no-daemon-imports-terminal',
      comment:
        'daemon must not import from terminal. Only the composition root (main.ts / layers.ts) may wire terminal layers.',
      severity: 'error',
      from: {
        path: '^src/modules/daemon',
        pathNot: '^src/modules/daemon/(main|infrastructure/layers)\\.ts$',
      },
      to: { path: '^src/modules/terminal' },
    },
    {
      name: 'no-session-imports-daemon',
      comment:
        'session must not import from daemon. Move DaemonConfig / DaemonNotRunningError to #shared/kernel/errors. CLI commands belong in daemon/infrastructure/adapters/in/commands.',
      severity: 'error',
      from: { path: '^src/modules/session' },
      to: { path: '^src/modules/daemon' },
    },
    {
      name: 'no-session-imports-terminal',
      comment: 'session must not import from terminal.',
      severity: 'error',
      from: { path: '^src/modules/session' },
      to: { path: '^src/modules/terminal' },
    },
    {
      name: 'no-terminal-imports-daemon',
      comment: 'terminal must not import from daemon.',
      severity: 'error',
      from: { path: '^src/modules/terminal' },
      to: { path: '^src/modules/daemon' },
    },
    {
      name: 'no-terminal-imports-session',
      comment:
        'terminal must not import from session. Move SessionDomainEvent to #shared/kernel/domain-events.',
      severity: 'error',
      from: { path: '^src/modules/terminal' },
      to: { path: '^src/modules/session' },
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
