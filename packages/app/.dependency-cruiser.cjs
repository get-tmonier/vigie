/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Cross-module boundaries ────────────────────────────────────────────────
    //
    // Three modules: daemon / session / terminal.
    // Cross-module imports are forbidden except in:
    //   - daemon composition root: main.ts (wires all layers via Effect Layers)
    //   - UI islands: cross-module UI composition is allowed in ui/ adapters
    //
    // Shared types (IPC protocol, domain events, errors, SessionId) must live in
    // #shared/kernel/* — never re-imported across module boundaries.

    {
      name: 'no-daemon-imports-session',
      comment:
        'daemon must not import from session. Move shared types to #shared/kernel/* or introduce a SessionCommandShape port in daemon.',
      severity: 'error',
      from: {
        path: '^src/modules/daemon',
        pathNot: [
          '^src/modules/daemon/main\\.ts$',
          'src/modules/daemon/.*/ui/.*',
        ],
      },
      to: { path: '^src/modules/session' },
    },
    {
      name: 'no-daemon-imports-terminal',
      comment:
        'daemon must not import from terminal. Only the composition root (main.ts) may wire terminal layers.',
      severity: 'error',
      from: {
        path: '^src/modules/daemon',
        pathNot: [
          '^src/modules/daemon/main\\.ts$',
          'src/modules/daemon/.*/ui/.*',
        ],
      },
      to: { path: '^src/modules/terminal' },
    },
    {
      name: 'no-session-imports-daemon',
      comment:
        'session must not import from daemon. Move DaemonConfig / DaemonNotRunningError to #shared/kernel/errors. CLI commands belong in daemon/infrastructure/adapters/in/commands.',
      severity: 'error',
      from: {
        path: '^src/modules/session',
        pathNot: 'src/modules/session/.*/ui/.*',
      },
      to: { path: '^src/modules/daemon' },
    },
    {
      name: 'no-session-imports-terminal',
      comment: 'session must not import from terminal.',
      severity: 'error',
      from: {
        path: '^src/modules/session',
        pathNot: 'src/modules/session/.*/ui/.*',
      },
      to: { path: '^src/modules/terminal' },
    },
    {
      name: 'no-terminal-imports-daemon',
      comment: 'terminal must not import from daemon.',
      severity: 'error',
      from: {
        path: '^src/modules/terminal',
        pathNot: 'src/modules/terminal/.*/ui/.*',
      },
      to: { path: '^src/modules/daemon' },
    },
    {
      name: 'no-terminal-imports-session',
      comment:
        'terminal must not import from session. Move SessionDomainEvent to #shared/kernel/domain-events.',
      severity: 'error',
      from: {
        path: '^src/modules/terminal',
        pathNot: 'src/modules/terminal/.*/ui/.*',
      },
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
