# Hexagonal Architecture Refacto — Design Spec

Date: 2026-04-08
Branch: `refacto/effectifyremaining`

## Context

The current codebase has three modules (`daemon`, `session`, `terminal`) with blurry boundaries:
`session.service.ts` owns PTY handles and CLI channel routing (terminal concerns), `main.ts` is both
composition root and business logic, `shared/kernel` grew into a catch-all, and the dependency-cruiser
config is hardcoded to specific file paths.

This spec defines the target architecture.

---

## Module decomposition

Two bounded contexts:

### `daemon`
Owns: daemon lifecycle, HTTP/WS server, IPC server, CLI command handling, config, process management.
Does not own: session state, PTY, terminal chunks, agent logic.
Session IDs are opaque `string` — branding is agent-session's concern.

### `agent-session` (merged `session` + `terminal`)
Owns: session lifecycle, PTY management, terminal chunks, input buffering, agent adapters,
resumability, domain events.
`SessionId` branded type lives here. Domain events published via `EventPublisher` port.
Does not own: HTTP serving, IPC protocol, daemon config.

**Why merge**: `session.service.ts` already manages PTY handles, resize priority, and CLI channel
routing. Session and terminal are tightly coupled — the boundary between them was artificial and
caused `terminal-gateway.ts` to leak into shared kernel.

---

## Entry points

Two executables, two thin files at `src/`:

```
src/daemon.ts        — imports AppDependencies, calls BunRuntime.runMain()
src/cli.ts           — Effect CLI commands + DaemonConfigLayer (already thin)
src/dependencies.ts  — root composition: wires modules, event adaptation
```

`daemon.ts` replaces `modules/daemon/main.ts`. The composition root moves out of the daemon module
so daemon doesn't implicitly own the whole app's wiring.

The CLI has no `dependencies.ts` — it only needs `DaemonConfigLayer` to locate the IPC socket.

---

## Shared kernel

**Only `src/shared/kernel/ipc-protocol.ts` survives.**

Rule of thumb (documented in `src/modules/CLAUDE.md`): shared kernel is for cross-cutting wire
protocols owned by no single bounded context. If something moves there to escape an import error,
that is a boundary smell — fix the module design instead.

### What moves out of shared kernel

| File | Destination |
|------|-------------|
| `session-id.ts` | `agent-session/domain/session-id.ts` |
| `domain-events.ts` | `agent-session/domain/events.ts` |
| `errors.ts` (AgentRunnerError) | `agent-session/domain/errors.ts` |
| `errors.ts` (DaemonNotRunningError, IpcConnectionError) | `daemon/domain/errors.ts` |
| `terminal-gateway.ts` | deleted (internal to agent-session after merge) |
| `pty.ts` | `agent-session/infrastructure/adapters/out/pty/` |

---

## Cross-module event communication

agent-session publishes domain events via its `EventPublisher` port.
Daemon's WebSocket routes work with their own DTO types (`ws-schemas.ts`).
`src/dependencies.ts` (composition root) subscribes to agent-session's EventPublisher and adapts
events to daemon's WS broadcaster. No cross-module import needed.

---

## Per-module `dependencies.ts`

Each module owns its layer wiring:

**`src/modules/daemon/dependencies.ts`**
HTTP server, IPC server, Unix socket server, config layer, process manager.

**`src/modules/agent-session/dependencies.ts`**
SQLite session repo, SQLite terminal repo, PTY spawner, agent registry, event publisher,
resumability checker, terminal subscribers, all use case layers.

**`src/dependencies.ts`** (root)
- Merges module dependencies
- Provides shared infra (database layer)
- Wires event adaptation: agent-session EventPublisher → daemon WS broadcaster

---

## Use case decomposition (agent-session)

`session.service.ts` is deleted. No facade. IPC router and HTTP routes call use cases directly.

**Commands:**

| Use case | Responsibilities |
|----------|-----------------|
| `SpawnSessionUseCase` | `register`, `spawnInteractive`, `resume` — all "start a session" operations, share PTY spawn logic |
| `SessionLifecycleUseCase` | `markEnded`, `markError`, `deregister`, `setAgentSessionId` — IPC-driven state transitions |
| `SessionCleanupUseCase` | `delete`, `deleteAllEnded` — user-initiated cleanup |
| `TerminalConnectionUseCase` | `attach`, `detach`, `updateCliResize`, `handleDisconnect`, `writeInput` — CLI connection management around a live PTY |
| `CheckResumabilityUseCase` | Background job — runs every 5s, updates resumability for active sessions |

**Queries:**

| Use case | Responsibilities |
|----------|-----------------|
| `SessionQueriesUseCase` | `listAll`, `findById`, `getAllChunks`, `getInputHistory` — pure reads, no side effects |

Each is its own file under `agent-session/application/use-cases/`.
The daemon's `SessionCommandShape` port (used by IPC router and HTTP routes) is shaped after these use case interfaces directly — no intermediate service layer.

---

## CLAUDE.md files

Three files, all short (bullet points, no prose):

**`src/modules/CLAUDE.md`**
- General boundary rules: no cross-module imports, only `dependencies.ts` may wire across
- Shared kernel rule of thumb
- Each module owns its `CLAUDE.md`, `dependencies.ts`, and domain

**`src/modules/daemon/CLAUDE.md`**
- What daemon owns and does not own
- Session IDs are opaque string here

**`src/modules/agent-session/CLAUDE.md`**
- What agent-session owns
- SessionId branded type lives here
- Events published via EventPublisher port, daemon adapts at root

---

## dependency-cruiser — generic rules (Approach A)

No hardcoded module names. Three rules cover everything:

**Rule 1 — no cross-module imports (generic)**
```
from: src/modules/X/...
to:   src/modules/Y/...   (where X ≠ Y, via backreference)
```
Adding a new module requires zero config changes.

**Rule 2 — shared kernel is one-way**
```
from: src/shared/...
to:   src/modules/...     ← forbidden
```

**Rule 3 — composition roots are the only exception**
Allowed cross-module files (by name pattern, not hardcoded path):
- `src/dependencies.ts`
- `src/modules/*/dependencies.ts`
- `src/modules/*/infrastructure/adapters/in/ui/**`

No more `main.ts` exception. No more `pathNot` listing specific files.

---

## Target file structure (key files only)

```
src/
  daemon.ts
  cli.ts
  dependencies.ts
  shared/
    kernel/
      ipc-protocol.ts
    lib/
      cn.ts
      path.ts
  modules/
    CLAUDE.md
    daemon/
      CLAUDE.md
      dependencies.ts
      domain/
        errors.ts          (DaemonNotRunningError, IpcConnectionError)
        daemon-info.ts
      application/
        ports/
          out/             (SessionCommandShape, IpcServer, ProcessManager)
        use-cases/         (runDaemon, startup cleanup, prune sessions)
      infrastructure/
        adapters/
          in/              (HTTP routes, IPC router, CLI commands, ws-schemas)
          out/             (unix-socket-server, bun-process-manager)
        daemon-config.ts
    agent-session/
      CLAUDE.md
      dependencies.ts
      domain/
        session.ts
        session-id.ts
        events.ts          (SessionDomainEvent + TerminalEvents)
        errors.ts          (AgentRunnerError, CannotResumeSessionError, ...)
        session-status.ts
      application/
        ports/
          out/             (SessionRepository, AgentRegistry, ResumabilityChecker, EventPublisher)
        use-cases/
          spawn-session.use-case.ts
          session-lifecycle.use-case.ts
          session-cleanup.use-case.ts
          terminal-connection.use-case.ts
          check-resumability.use-case.ts
          session-queries.use-case.ts
      infrastructure/
        adapters/
          in/              (session routes, terminal routes, UI)
          out/             (SQLite repos, PTY spawner, agent adapters, event publisher impl)
```

---

## Out of scope

- No change to `@vigie/landing`, `@vigie/tokens`, `@vigie/video`
- No new features — pure structural refactor
- `cli.ts` internal content is already correct, only minor import path updates needed
