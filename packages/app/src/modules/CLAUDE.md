# Module Boundary Rules

- `modules/agent-session` is the only domain module.
- `modules/agent-session` must not import from `src/shell/`.
- `modules/agent-session/dependencies.ts` wires only agent-session's own infrastructure.
- Cross-module composition (agent-session + shell) happens exclusively in `src/dependencies.ts`.
- Shared kernel (`#shared/kernel/`) contains domain types shared across modules: session identity, domain events, value objects.
- Protocol schemas (IPC, browser) live in `#shell/protocols/` — they are shell-internal infrastructure contracts.
