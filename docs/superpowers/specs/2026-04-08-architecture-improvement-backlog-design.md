# Architecture Improvement Backlog

**Date:** 2026-04-08
**Scope:** `@vigie/app` — ordered pragmatic backlog of architectural improvements
**Priority system:** P1 = fix now (safety/correctness), P2–P3 = architectural integrity, P4–P5 = coverage expansion, P6 = documentation

---

## Fixes Applied During Review Session

The following issues from the code review were fixed before this spec was written:

| Fix | File |
|-----|------|
| `parseInt(rawPort) \|\| 19191` → `Number.isNaN` guard | `daemon-config.ts` |
| `./dependencies` relative import → `#dependencies` alias | `src/daemon.ts` |
| `checkResumableForAll` inline duplication + silent event drop | `check-resumability.use-case.ts`, `agent-session/dependencies.ts` |
| Dependency-cruiser UI island path missing `^` anchor | `.dependency-cruiser.cjs` |
| `shared/kernel/CLAUDE.md` created documenting `agentType` open-string convention | `shared/kernel/CLAUDE.md` |

---

## P1 — Domain + Application Unit Tests

### Problem

The Session aggregate has a non-trivial state machine, domain events, and invariants. None of it has tests. Every refactoring is done blind.

### What to build

Location: mirror the source path under `__tests__/`.

**Domain tests** (`modules/agent-session/domain/__tests__/`):

- `session.unit.test.ts`
  - All valid state transitions: create → active, active → ended, active → error, ended → active (reactivate)
  - Invalid transitions throw `InvalidStatusTransitionError`
  - `pullEvents()` drains the queue and returns all accumulated events
  - `pullEvents()` called twice returns empty array on second call
  - `canResume` is true only when `status === 'ended' && resumable && agentSessionId != null`
  - `setResumable()` emits `session:resumable-changed` only when value actually changes
  - `delete()` succeeds from ended/error, throws `CannotDeleteActiveSessionError` from active
- `session-status.unit.test.ts` — `canTransition()` truth table (all from/to combos)
- `errors.unit.test.ts` — `SessionNotFoundError`, `CannotResumeSessionError`, `CannotDeleteActiveSessionError` are properly tagged

**Use case tests** (`modules/agent-session/application/use-cases/__tests__/`):

All use cases use fake port implementations (plain objects matching port interfaces, no mocking library).

- `spawn-session.use-case.unit.test.ts`
- `session-lifecycle.use-case.unit.test.ts`
- `session-cleanup.use-case.unit.test.ts`
- `session-queries.use-case.unit.test.ts`
- `check-resumability.use-case.unit.test.ts`
  - `checkResumableForAll`: verifies events are published (not silently dropped)
  - `checkResumableForActive`: covers active + recently-ended paths

### Acceptance criteria

- `bun turbo test` passes
- Every domain invariant has at least one test

---

## P2 — Error Handling Standardization

### Problem

`InvalidStatusTransitionError` and `CannotDeleteActiveSessionError` in `agent-session/domain/errors.ts` are plain `Error` subclasses with a manual `_tag` field. They cannot be used with `Effect.catchTag` and do not carry structured context.

### What to do

Migrate both to `Data.TaggedError` with structured fields:

```ts
import { Data } from 'effect';
import type { SessionStatus } from './session-status';

export class InvalidStatusTransitionError extends Data.TaggedError('InvalidStatusTransitionError')<{
  readonly from: SessionStatus;
  readonly to: SessionStatus;
}> {}

export class CannotDeleteActiveSessionError extends Data.TaggedError('CannotDeleteActiveSessionError')<{
  readonly sessionId: string;
}> {}
```

Update all throw sites to pass the structured context. Update tests (P1) to assert on the structured fields.

### Acceptance criteria

- No `extends Error` with manual `_tag` in the domain layer
- All domain errors use `Data.TaggedError`
- Typecheck passes

---

## P3 — HTTP Error → Status Code Mapping

### Problem

Every error thrown from a route handler collapses to a generic 500. `SessionNotFoundError` should return 404, `CannotDeleteActiveSessionError` should return 409. This is incorrect for any API consumer.

**Depends on:** P2 (all errors must be `TaggedError` to use `Effect.catchTags`).

### What to do

In `session.routes.tsx`, replace the catch-all with typed `Effect.catchTags`:

```ts
Effect.catchTags({
  SessionNotFoundError: (e) =>
    HttpServerResponse.json({ error: e.message }, { status: 404 }),
  CannotDeleteActiveSessionError: (e) =>
    HttpServerResponse.json({ error: e.message }, { status: 409 }),
  CannotResumeSessionError: (e) =>
    HttpServerResponse.json({ error: e.message }, { status: 409 }),
})
```

Keep a final catch-all for unexpected errors that still returns 500.

### Status code mapping

| Error | HTTP Status |
|-------|-------------|
| `SessionNotFoundError` | 404 |
| `CannotDeleteActiveSessionError` | 409 |
| `CannotResumeSessionError` | 409 |
| All others | 500 |

### Acceptance criteria

- `DELETE /sessions/:unknownId` returns 404
- `DELETE /sessions/:activeId` returns 409
- Typecheck passes

---

## P4 — Env Variable Validation (Valibot)

### Problem

`VIGIE_HOME` and `VIGIE_PORT` are read from `process.env` in `daemon-config.ts` with no validation. A bad value silently produces wrong runtime behavior.

### What to do

Add a Valibot schema in `daemon-config.ts` and validate at Layer construction:

```ts
const EnvSchema = v.object({
  VIGIE_HOME: v.optional(v.string()),
  VIGIE_PORT: v.optional(
    v.pipe(
      v.string(),
      v.transform(Number),
      v.number(),
      v.integer(),
      v.minValue(1),
      v.maxValue(65535)
    )
  ),
});
```

Throw a descriptive error if validation fails so the daemon refuses to start with invalid config rather than silently misbehaving.

### Acceptance criteria

- Starting the daemon with `VIGIE_PORT=abc` exits with a clear error message
- Typecheck passes

---

## P5 — Session Resume Hardcoded for Claude

### Problem

`session-resume.command.ts` explicitly rejects non-Claude agents and hardcodes `~/.claude/` path logic. This breaks the agent-agnostic design from CLAUDE.md and blocks adding any second agent.

### What to do

Replace the hardcoded Claude check with `AgentAdapter.canResume(session)`. The port interface already exists in `agent-adapter.port.ts`. The Claude-specific path logic belongs in `claude.adapter.ts`.

Also change `agentType` check from a string literal comparison to a registry lookup:

```ts
// before
if (session.agentType !== 'claude') throw new CannotResumeSessionError(...)

// after  
const adapter = agentRegistry.resolve(session.agentType);
if (!adapter.canResume(session)) throw new CannotResumeSessionError(...)
```

### Acceptance criteria

- No string literal `'claude'` in `session-resume.command.ts`
- `claude.adapter.ts` owns all Claude-specific resumability logic
- Typecheck passes

---

## P6 — `Effect.runFork` Event Publishing — Explicit Pattern

### Problem

`Effect.runFork(publishEvents(...))` appears 15+ times across use cases. Errors are silently swallowed. The fire-and-forget pattern is intentional (domain operations should not fail because of event publishing) but is implicit and produces no observable failure signal.

### What to do

Introduce a `fireAndForget` helper inside each use case file that uses the pattern:

```ts
function fireAndForget(effect: Effect.Effect<void>): void {
  Effect.runFork(
    Effect.catchAllCause(effect, (cause) =>
      Effect.logWarning('Event publish failed (non-fatal)', cause)
    )
  );
}
```

Replace all bare `Effect.runFork(publishEvents(...))` calls with `fireAndForget(publishEvents(...))`.

This is a local helper, not a shared utility — it stays in each file to keep the intent readable.

### Acceptance criteria

- No bare `Effect.runFork(publishEvents(...))` without error logging
- Typecheck and tests pass

---

## P7 — Integration Tests: SQLite Repositories

### Problem

The SQLite adapters are the persistence boundary. Schema correctness, query behavior, and edge cases are unverified.

### What to build

Location: `modules/agent-session/infrastructure/adapters/out/__tests__/`

- `sqlite-session-repository.integration.test.ts`
  - Uses `bun:sqlite` in-memory database (`:memory:`)
  - Tests: `save`, `findById`, `findAll`, `findActive`, `findActiveWithAgentId`, `findRecentlyEnded`, `delete`, `markOrphanedEnded`, `pruneOld`
- `sqlite-terminal-repository.integration.test.ts`
  - Tests: `appendChunk`, `getChunks`, `appendInputHistory`, `getInputHistory`

### Acceptance criteria

- Tests run without a real filesystem database
- All repository methods have at least one happy path test
- `bun turbo test` passes

---

## P8 — Integration Tests: HTTP Routes

### Problem

The HTTP routes wire use cases to HTTP but have never been tested end-to-end.

### What to build

Location: `modules/agent-session/infrastructure/adapters/in/__tests__/`

- `session.routes.integration.test.ts`
  - Uses fake port implementations for all use case dependencies
  - Tests: `GET /api/sessions` returns session list, `POST /sessions/create` spawns session, `DELETE /sessions/:id` returns 404 for unknown session (requires P3)

### Acceptance criteria

- `bun turbo test` passes

---

## P9 — CliSender Port Ownership Documentation

### Problem

`CliSender` is a port defined in `agent-session` but implemented in `daemon/dependencies.ts`. This dependency direction reversal is valid and intentional but confusing.

### What to do

1. Add a comment at the `CliSender` port definition explaining that this port is implemented by the daemon layer via callback injection at the composition root.
2. Add a note to `daemon/CLAUDE.md` under a "Implements ports from other modules" section.

### Acceptance criteria

- A developer reading `cli-sender.port.ts` understands why it is defined here but implemented elsewhere

---

## P10 — Architecture Decision Records (ADRs)

### Problem

Key architectural decisions have no documentation. The "why" is not in the codebase.

### What to build

Create `docs/adr/` with one file per decision:

- `001-single-process-daemon.md` — Why single process instead of separate HTTP server + daemon
- `002-in-memory-event-bus.md` — Why events are not persisted; what is lost on restart and why that is acceptable
- `003-effect-layer-di.md` — Why Effect.Layer over manual DI or a container
- `004-unix-socket-ipc.md` — Why Unix socket over HTTP/TCP for CLI–daemon communication
- `005-sqlite-local-only.md` — Why SQLite; what the constraint means for future multi-machine use

Each ADR: Status, Context, Decision, Consequences. Max one page.

---

## Implementation Order

Work items are independent within each priority tier and can be executed in parallel where possible.

```
P1 (tests)       → unblocks safe refactoring for everything else
P2 (error types) → unblocks P3
P3 (HTTP codes)  → depends on P2
P4 (env validation) → independent
P5 (resume fix)  → independent
P6 (runFork)     → independent
P7 (repo tests)  → independent
P8 (route tests) → benefits from P3
P9 (docs)        → independent
P10 (ADRs)       → independent
```
