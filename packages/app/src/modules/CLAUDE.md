# Module Boundary Rules

- `modules/agent-session` is the only domain module.
- `modules/agent-session` must not import from `src/shell/` or `src/shared/ssr/`.
- `modules/agent-session/dependencies.ts` wires only agent-session's own infrastructure.
- Cross-module composition (agent-session + shell) happens exclusively in `src/dependencies.ts`.
- Shared kernel (`#shared/kernel/`) is for cross-cutting contracts owned by no single bounded context.
