# Hexagonal Architecture Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `packages/app/src/modules/` from three leaky modules (daemon/session/terminal) into two clean bounded contexts (daemon + agent-session), delete the session.service.ts god object, and enforce cross-module boundaries via generic dependency-cruiser rules.

**Architecture:** `session` + `terminal` modules merge into `agent-session`. Business logic in `session.service.ts` is split into six focused use-case factory functions sharing a `PtyRegistry` internal module. The composition root moves from `modules/daemon/main.ts` to `src/daemon.ts` + `src/dependencies.ts`, with each module owning its own `dependencies.ts`.

**Tech Stack:** Bun, Effect v4 (Layer, ServiceMap, Effect.gen), TypeScript strict, Valibot, SQLite via `#infra/database`, biome lint/format.

**Base path for all file ops:** `packages/app/src/`

---

## File Map (created/modified/deleted)

### Created
| New path | Purpose |
|---|---|
| `modules/agent-session/domain/session-id.ts` | SessionId branded type (moved from shared/kernel) |
| `modules/agent-session/domain/events.ts` | SessionDomainEvent + TerminalEvents (moved from shared/kernel) |
| `modules/agent-session/domain/errors.ts` | SessionNotFoundError, CannotResumeSessionError, etc (moved from session/domain) |
| `modules/agent-session/domain/session-status.ts` | SessionStatus enum (moved from session/domain) |
| `modules/agent-session/domain/session.ts` | Session aggregate (moved from session/domain) |
| `modules/agent-session/application/ports/out/session-repository.port.ts` | Moved from session module |
| `modules/agent-session/application/ports/out/agent-adapter.port.ts` | Moved from session module |
| `modules/agent-session/application/ports/out/resumability-checker.port.ts` | Moved from session module |
| `modules/agent-session/application/ports/out/event-publisher.port.ts` | Moved from terminal module |
| `modules/agent-session/application/ports/out/pty-spawner.port.ts` | Moved from terminal module |
| `modules/agent-session/application/ports/out/terminal-repository.port.ts` | Moved from terminal module |
| `modules/agent-session/infrastructure/pty-registry.ts` | Shared in-memory PTY state for use cases |
| `modules/agent-session/application/use-cases/spawn-session.use-case.ts` | register + spawnInteractive + resume |
| `modules/agent-session/application/use-cases/session-lifecycle.use-case.ts` | markEnded + markError + deregister + setAgentSessionId |
| `modules/agent-session/application/use-cases/session-cleanup.use-case.ts` | delete + deleteAllEnded |
| `modules/agent-session/application/use-cases/terminal-connection.use-case.ts` | attach + detach + updateCliResize + handleDisconnect + writeInput + kill + browser channel mgmt |
| `modules/agent-session/application/use-cases/check-resumability.use-case.ts` | Background resumability check |
| `modules/agent-session/application/use-cases/session-queries.use-case.ts` | listAll + findById + getAllChunks + getInputHistory |
| `modules/agent-session/infrastructure/adapters/in/session.routes.tsx` | Moved + updated from session module |
| `modules/agent-session/infrastructure/adapters/in/terminal.routes.ts` | Moved + updated from terminal module |
| `modules/agent-session/infrastructure/adapters/in/browser-events.ts` | Moved from terminal module |
| `modules/agent-session/infrastructure/adapters/in/session.dto.ts` | Moved from session module |
| `modules/agent-session/infrastructure/adapters/in/session.mapper.ts` | Moved from session module |
| `modules/agent-session/infrastructure/adapters/in/session.page.tsx` | Moved from session module |
| `modules/agent-session/infrastructure/adapters/in/ui/` | All UI islands moved from session + terminal modules |
| `modules/agent-session/infrastructure/adapters/out/sqlite-session-repository.ts` | Moved from session module |
| `modules/agent-session/infrastructure/adapters/out/fs-resumability-checker.ts` | Moved from session module |
| `modules/agent-session/infrastructure/adapters/out/agents/` | All agent adapters moved from session module |
| `modules/agent-session/infrastructure/adapters/out/event-publisher.adapter.ts` | Moved from terminal module |
| `modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository.ts` | Moved from terminal module |
| `modules/agent-session/infrastructure/adapters/out/bun-pty-spawner.ts` | Moved from terminal module |
| `modules/agent-session/infrastructure/adapters/out/pty/` | PTY native files moved from terminal module |
| `modules/agent-session/infrastructure/adapters/out/terminal-subscribers.ts` | Moved from terminal module |
| `modules/agent-session/dependencies.ts` | Layer wiring for agent-session module |
| `modules/daemon/dependencies.ts` | Layer wiring for daemon module |
| `modules/daemon/application/use-cases/run-daemon.use-case.ts` | runDaemon Effect (moved from main.ts) |
| `daemon.ts` (at `src/`) | Thin entry point: BunRuntime.runMain |
| `dependencies.ts` (at `src/`) | Root composition: merges modules, wires event adaptation |
| `modules/CLAUDE.md` | Cross-module boundary rules |
| `modules/daemon/CLAUDE.md` | Daemon-specific rules |
| `modules/agent-session/CLAUDE.md` | Agent-session-specific rules |

### Modified
| Path | Change |
|---|---|
| `modules/daemon/domain/errors.ts` | Own DaemonNotRunningError/IpcConnectionError (stop re-exporting from shared/kernel) |
| `modules/daemon/application/ports/in/session-command.port.ts` | Renamed to spawn-session.port.ts (SpawnSessionShape) + new files for other shapes |
| `modules/daemon/infrastructure/adapters/in/ipc-router.ts` | Accept split use case shapes instead of SessionCommandShape |
| `modules/daemon/infrastructure/adapters/in/fs.routes.ts` | Update import of `| never` RouteError (remove redundant union) |
| `packages/app/package.json` | Update `dev` script to point to `src/daemon.ts` |
| `.dependency-cruiser.cjs` | Replace hardcoded rules with generic 3-rule approach |

### Deleted
| Path | Reason |
|---|---|
| `modules/session/` (entire directory) | Merged into agent-session |
| `modules/terminal/` (entire directory) | Merged into agent-session |
| `modules/daemon/main.ts` | Split into run-daemon.use-case.ts + src/daemon.ts + src/dependencies.ts |
| `shared/kernel/session-id.ts` | Moved to agent-session/domain |
| `shared/kernel/domain-events.ts` | Moved to agent-session/domain |
| `shared/kernel/terminal-gateway.ts` | Deleted (internal to agent-session after merge) |
| `shared/kernel/pty.ts` | Moved to agent-session infrastructure |

> **`AgentRunnerError` stays in `shared/kernel/errors.ts`** — used by `#lib/agent-runner.ts` and `daemon/infrastructure/adapters/out/agents/claude-runner.adapter.ts`, both of which are outside agent-session. Moving it would require lib → module dependencies.

---

## Task 1: Create agent-session domain layer

**Files:**
- Create: `modules/agent-session/domain/session-id.ts`
- Create: `modules/agent-session/domain/events.ts`
- Create: `modules/agent-session/domain/errors.ts`
- Create: `modules/agent-session/domain/session-status.ts`
- Create: `modules/agent-session/domain/session.ts`
- Modify: `modules/daemon/domain/errors.ts`

- [ ] **Step 1: Create `modules/agent-session/domain/session-id.ts`**

```typescript
import { Brand } from 'effect';

export type SessionId = string & Brand.Brand<'SessionId'>;
export const SessionId = Brand.nominal<SessionId>();
```

- [ ] **Step 2: Create `modules/agent-session/domain/events.ts`**

Copy the entire contents of `shared/kernel/domain-events.ts`, updating the import to use the local `session-id`:

```typescript
import type { SessionId } from '#modules/agent-session/domain/session-id';

export type SessionStarted = {
  readonly type: 'session:started';
  readonly sessionId: SessionId;
  readonly agentType: string;
  readonly mode: 'prompt' | 'interactive';
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly repoName?: string;
  readonly timestamp: number;
};

export type SessionEnded = {
  readonly type: 'session:ended';
  readonly sessionId: SessionId;
  readonly exitCode: number;
  readonly resumable: boolean;
  readonly timestamp: number;
};

export type SessionError = {
  readonly type: 'session:error';
  readonly sessionId: SessionId;
  readonly error: string;
  readonly timestamp: number;
};

export type SessionDeleted = {
  readonly type: 'session:deleted';
  readonly sessionId: SessionId;
  readonly timestamp: number;
};

export type SessionsCleared = {
  readonly type: 'sessions:cleared';
  readonly timestamp: number;
};

export type AgentSessionIdDetected = {
  readonly type: 'session:agent-id-detected';
  readonly sessionId: SessionId;
  readonly agentSessionId: string;
  readonly timestamp: number;
};

export type ResumableChanged = {
  readonly type: 'session:resumable-changed';
  readonly sessionId: SessionId;
  readonly resumable: boolean;
  readonly timestamp: number;
};

export type SessionDomainEvent =
  | SessionStarted
  | SessionEnded
  | SessionError
  | SessionDeleted
  | SessionsCleared
  | AgentSessionIdDetected
  | ResumableChanged;

export type TerminalOutputEvent = {
  readonly type: 'terminal:output';
  readonly sessionId: string;
  readonly data: string;
  readonly timestamp: number;
};

export type TerminalInputEchoEvent = {
  readonly type: 'terminal:input-echo';
  readonly sessionId: string;
  readonly text: string;
  readonly source: 'cli' | 'browser';
  readonly timestamp: number;
};

export type TerminalResizedEvent = {
  readonly type: 'terminal:pty-resized';
  readonly sessionId: string;
  readonly cols: number;
  readonly rows: number;
};

export type DomainEvent =
  | SessionDomainEvent
  | TerminalOutputEvent
  | TerminalInputEchoEvent
  | TerminalResizedEvent;
```

- [ ] **Step 3: Create `modules/agent-session/domain/errors.ts`**

This owns the session-domain errors AND re-exports `AgentRunnerError` from shared/kernel (same pattern as current `session/domain/errors.ts`):

```typescript
import { Data } from 'effect';

export { AgentRunnerError } from '#shared/kernel/errors';

export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly sessionId: string;
}> {
  constructor(sessionId: string) {
    super({ sessionId });
  }
  override get message(): string {
    return `Session not found: ${this.sessionId}`;
  }
}

export class InvalidStatusTransitionError extends Error {
  readonly _tag = 'InvalidStatusTransitionError';
  constructor(from: string, to: string) {
    super(`Cannot transition session from '${from}' to '${to}'`);
  }
}

export class CannotDeleteActiveSessionError extends Error {
  readonly _tag = 'CannotDeleteActiveSessionError';
  constructor(sessionId: string) {
    super(`Cannot delete active session: ${sessionId}`);
  }
}

export class CannotResumeSessionError extends Data.TaggedError('CannotResumeSessionError')<{
  readonly sessionId: string;
  readonly reason: string;
}> {
  constructor(sessionId: string, reason: string) {
    super({ sessionId, reason });
  }
  override get message(): string {
    return `Cannot resume session ${this.sessionId}: ${this.reason}`;
  }
}
```

- [ ] **Step 4: Create `modules/agent-session/domain/session-status.ts`**

Copy verbatim from `modules/session/domain/session-status.ts` (no import changes needed — it has no cross-module imports).

Run: `cat packages/app/src/modules/session/domain/session-status.ts` and copy to new path.

- [ ] **Step 5: Create `modules/agent-session/domain/session.ts`**

Copy from `modules/session/domain/session.ts`, updating imports:

```typescript
// Change:
import type { SessionDomainEvent } from '#shared/kernel/domain-events';
import type { SessionId } from '#shared/kernel/session-id';
import { SessionId as makeSessionId } from '#shared/kernel/session-id';
// To:
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';
import type { SessionId } from '#modules/agent-session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
```

Also update the error imports:
```typescript
// Change:
import { ... } from '../domain/errors';
// To (relative path within agent-session/domain/):
import { ... } from '#modules/agent-session/domain/errors';
```

Also update the status import:
```typescript
// Change:
import type { SessionStatus } from './session-status';
// To:
import type { SessionStatus } from '#modules/agent-session/domain/session-status';
```

- [ ] **Step 6: Update `modules/daemon/domain/errors.ts`**

Currently re-exports from shared/kernel. Make it own the types directly:

```typescript
import { Data } from 'effect';

export class DaemonNotRunningError extends Data.TaggedError('DaemonNotRunningError')<{
  readonly message: string;
}> {}

export class IpcConnectionError extends Data.TaggedError('IpcConnectionError')<{
  readonly message: string;
}> {}
```

- [ ] **Step 7: Run typecheck**

```bash
cd packages/app && bun run typecheck
```

Expected: errors only about missing imports (old files reference new paths that don't exist yet). New files themselves should be clean.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/modules/agent-session/domain/ packages/app/src/modules/daemon/domain/errors.ts
git commit -m "refactor(agent-session): create domain layer — session-id, events, errors, session, status"
```

---

## Task 2: Create agent-session application ports

**Files:**
- Create: `modules/agent-session/application/ports/out/session-repository.port.ts`
- Create: `modules/agent-session/application/ports/out/agent-adapter.port.ts`
- Create: `modules/agent-session/application/ports/out/resumability-checker.port.ts`
- Create: `modules/agent-session/application/ports/out/event-publisher.port.ts`
- Create: `modules/agent-session/application/ports/out/pty-spawner.port.ts`
- Create: `modules/agent-session/application/ports/out/terminal-repository.port.ts`

- [ ] **Step 1: Create `modules/agent-session/application/ports/out/session-repository.port.ts`**

Copy from `modules/session/application/ports/out/session-repository.port.ts`, update import:
```typescript
// Change:
import type { SessionId } from '#shared/kernel/session-id';
import type { Session } from '../../domain/session';
// To:
import type { SessionId } from '#modules/agent-session/domain/session-id';
import type { Session } from '#modules/agent-session/domain/session';
```
Keep the `SessionRepositoryShape` interface and `SessionRepository` ServiceMap.Service class unchanged.

- [ ] **Step 2: Create `modules/agent-session/application/ports/out/agent-adapter.port.ts`**

Copy from `modules/session/application/ports/out/agent-adapter.port.ts` verbatim (no cross-module imports to update — it uses only local types).

- [ ] **Step 3: Create `modules/agent-session/application/ports/out/resumability-checker.port.ts`**

Copy from `modules/session/application/ports/out/resumability-checker.port.ts` verbatim.

- [ ] **Step 4: Create `modules/agent-session/application/ports/out/event-publisher.port.ts`**

Copy from `modules/terminal/application/ports/out/event-publisher.port.ts`, updating the import:
```typescript
// Change:
import type { DomainEvent } from '#shared/kernel/domain-events';
// To:
import type { DomainEvent } from '#modules/agent-session/domain/events';
```

- [ ] **Step 5: Create `modules/agent-session/application/ports/out/pty-spawner.port.ts`**

Copy from `modules/terminal/application/ports/out/pty-spawner.port.ts`, but inline the `PtyHandle` type instead of re-exporting from shared/kernel:

```typescript
import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { AgentRunnerError } from '#shared/kernel/errors';

export interface PtyHandle {
  readonly pid: number;
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onOutput(callback: (data: Uint8Array) => void): void;
  wait(): Promise<number>;
}

export interface PtySpawnerShape {
  spawn(
    command: string,
    args: string[],
    cwd: string,
    cols: number,
    rows: number
  ): Effect.Effect<PtyHandle, AgentRunnerError>;
}

export class PtySpawner extends ServiceMap.Service<PtySpawner, PtySpawnerShape>()(
  '@vigie/PtySpawner'
) {}
```

- [ ] **Step 6: Create `modules/agent-session/application/ports/out/terminal-repository.port.ts`**

Copy from `modules/terminal/application/ports/out/terminal-repository.port.ts` verbatim (no cross-module imports).

- [ ] **Step 7: Run typecheck**

```bash
cd packages/app && bun run typecheck
```

Expected: new port files typecheck clean. Old modules still compile (they don't import new files yet).

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/modules/agent-session/application/
git commit -m "refactor(agent-session): create application ports — session-repo, agent-adapter, event-publisher, pty-spawner, terminal-repo"
```

---

## Task 3: Create PtyRegistry internal module

**Files:**
- Create: `modules/agent-session/infrastructure/pty-registry.ts`

The `ptyHandles` map is shared state between `SpawnSessionUseCase` and `TerminalConnectionUseCase`. This internal module holds it.

- [ ] **Step 1: Create `modules/agent-session/infrastructure/pty-registry.ts`**

```typescript
import type { PtyHandle } from '#modules/agent-session/application/ports/out/pty-spawner.port';

export interface PtyEntry {
  handle: PtyHandle;
  cliChannels: Map<string, { cols: number; rows: number }>;
  browserChannels: Map<string, { cols: number; rows: number }>;
  ptyDimensions: { cols: number; rows: number };
}

export interface PtyRegistry {
  ptyHandles: Map<string, PtyEntry>;
  sessionConnections: Map<string, string>; // sessionId → connId
  connSessions: Map<string, string>;       // connId → sessionId
}

export function createPtyRegistry(): PtyRegistry {
  return {
    ptyHandles: new Map(),
    sessionConnections: new Map(),
    connSessions: new Map(),
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd packages/app && bun run typecheck
```

Expected: PASS (new file has no broken imports).

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/pty-registry.ts
git commit -m "refactor(agent-session): add PtyRegistry internal shared state module"
```

---

## Task 4: Create agent-session use cases

**Files:**
- Create: `modules/agent-session/application/use-cases/spawn-session.use-case.ts`
- Create: `modules/agent-session/application/use-cases/session-lifecycle.use-case.ts`
- Create: `modules/agent-session/application/use-cases/session-cleanup.use-case.ts`
- Create: `modules/agent-session/application/use-cases/terminal-connection.use-case.ts`
- Create: `modules/agent-session/application/use-cases/check-resumability.use-case.ts`
- Create: `modules/agent-session/application/use-cases/session-queries.use-case.ts`

These are extracted from `modules/session/application/session.service.ts`. All imports update to use `#modules/agent-session/...` paths.

- [ ] **Step 1: Create `modules/agent-session/application/use-cases/spawn-session.use-case.ts`**

```typescript
import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import { CannotResumeSessionError, SessionNotFoundError } from '#modules/agent-session/domain/errors';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import type { PtyHandle } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import type { PtySpawnerShape } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import { Session } from '#modules/agent-session/domain/session';
import type { SessionId } from '#modules/agent-session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { PtyRegistry, PtyEntry } from '#modules/agent-session/infrastructure/pty-registry';

interface SpawnSessionDeps {
  sessionRepo: SessionRepositoryShape;
  ptySpawner: PtySpawnerShape;
  resumabilityChecker: ResumabilityCheckerShape;
  agentRegistry: AgentRegistryShape;
  eventPublisher: EventPublisherShape;
  registry: PtyRegistry;
  setupPtyLifecycle: (sessionId: SessionId, entry: PtyEntry) => void;
}

export type SpawnSessionShape = ReturnType<typeof createSpawnSessionUseCase>;

export function createSpawnSessionUseCase(deps: SpawnSessionDeps) {
  const {
    sessionRepo,
    ptySpawner,
    resumabilityChecker,
    agentRegistry,
    eventPublisher,
    registry,
    setupPtyLifecycle,
  } = deps;

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  return {
    register(props: {
      sessionId: string;
      agentType: string;
      cwd: string;
      mode?: 'prompt' | 'interactive';
      gitBranch?: string;
      gitRemoteUrl?: string;
      repoName?: string;
      connId: string;
    }): void {
      const session = Session.create({
        id: props.sessionId,
        agentType: props.agentType,
        cwd: props.cwd,
        mode: props.mode ?? 'prompt',
        gitBranch: props.gitBranch,
        gitRemoteUrl: props.gitRemoteUrl,
        repoName: props.repoName,
      });
      sessionRepo.save(session);
      registry.sessionConnections.set(props.sessionId, props.connId);
      registry.connSessions.set(props.connId, props.sessionId);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    spawnInteractive(props: {
      sessionId?: string;
      agentType: string;
      cwd: string;
      cols: number;
      rows: number;
      connId?: string;
      agentSessionId?: string;
      resume?: boolean;
      gitBranch?: string;
      repoName?: string;
    }): Effect.Effect<{ sessionId: SessionId; pid: number }, AgentRunnerError> {
      return Effect.gen(function* () {
        const session = Session.create({
          id: props.sessionId,
          agentType: props.agentType,
          cwd: props.cwd,
          mode: 'interactive',
          gitBranch: props.gitBranch,
          repoName: props.repoName,
        });
        sessionRepo.save(session);

        const adapter = agentRegistry.resolve(props.agentType);
        const agentSessionId = props.agentSessionId ?? session.id;

        if (adapter.detectSessionId) {
          session.setAgentSessionId(agentSessionId);
          sessionRepo.save(session);
        }

        const { command, args } = adapter.buildSpawnArgs({
          agentSessionId,
          resume: props.resume,
        });
        const handle = yield* ptySpawner.spawn(command, args, props.cwd, props.cols, props.rows);

        const entry: PtyEntry = {
          handle,
          cliChannels: new Map(),
          browserChannels: new Map(),
          ptyDimensions: { cols: props.cols, rows: props.rows },
        };
        registry.ptyHandles.set(session.id, entry);

        if (props.connId) {
          registry.connSessions.set(props.connId, session.id);
          entry.cliChannels.set(props.connId, { cols: props.cols, rows: props.rows });
        }

        yield* Effect.forkChild(publishEvents(session.pullEvents()));
        setupPtyLifecycle(session.id, entry);

        return { sessionId: session.id, pid: handle.pid };
      });
    },

    resume(
      sessionId: string,
      opts: { cols: number; rows: number; connId?: string; gitBranch?: string; repoName?: string }
    ): Effect.Effect<
      { sessionId: SessionId; pid: number },
      SessionNotFoundError | CannotResumeSessionError | AgentRunnerError
    > {
      return Effect.gen(function* () {
        const id = makeSessionId(sessionId);
        const session = sessionRepo.findById(id);
        if (!session) return yield* new SessionNotFoundError(sessionId);

        const adapter = agentRegistry.resolve(session.agentType);
        if (!adapter.canResume || !session.canResume) {
          return yield* new CannotResumeSessionError(
            sessionId,
            session.agentSessionId ? 'session is not resumable' : 'no session ID'
          );
        }

        session.reactivate();
        sessionRepo.save(session);

        const { command, args } = adapter.buildSpawnArgs({
          agentSessionId: session.agentSessionId,
          resume: true,
        });
        const handle = yield* ptySpawner.spawn(command, args, session.cwd, opts.cols, opts.rows);

        const entry: PtyEntry = {
          handle,
          cliChannels: new Map(),
          browserChannels: new Map(),
          ptyDimensions: { cols: opts.cols, rows: opts.rows },
        };
        registry.ptyHandles.set(id, entry);

        if (opts.connId) {
          registry.connSessions.set(opts.connId, id);
          entry.cliChannels.set(opts.connId, { cols: opts.cols, rows: opts.rows });
        }

        yield* Effect.forkChild(publishEvents(session.pullEvents()));
        setupPtyLifecycle(id, entry);

        return { sessionId: id, pid: handle.pid };
      });
    },
  };
}
```

- [ ] **Step 2: Create `modules/agent-session/application/use-cases/session-lifecycle.use-case.ts`**

```typescript
import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';
import type { SessionId } from '#modules/agent-session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import type { PtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';

interface SessionLifecycleDeps {
  sessionRepo: SessionRepositoryShape;
  resumabilityChecker: ResumabilityCheckerShape;
  agentRegistry: AgentRegistryShape;
  eventPublisher: EventPublisherShape;
  registry: PtyRegistry;
}

export type SessionLifecycleShape = ReturnType<typeof createSessionLifecycleUseCase>;

export function createSessionLifecycleUseCase(deps: SessionLifecycleDeps) {
  const { sessionRepo, resumabilityChecker, agentRegistry, eventPublisher, registry } = deps;

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  return {
    markEnded(sessionId: string, exitCode: number): void {
      const id = makeSessionId(sessionId);
      const session = sessionRepo.findById(id);
      if (!session) return;

      const adapter = agentRegistry.resolve(session.agentType);
      const resumable =
        adapter.canResume &&
        session.agentSessionId != null &&
        resumabilityChecker.isResumable(session.agentSessionId, session.cwd);

      session.markEnded(exitCode, resumable);
      sessionRepo.save(session);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    markError(sessionId: string, error: string): void {
      const id = makeSessionId(sessionId);
      const session = sessionRepo.findById(id);
      if (!session) return;
      session.markError(error);
      sessionRepo.save(session);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    setAgentSessionId(sessionId: string, agentSessionId: string): void {
      const id = makeSessionId(sessionId);
      const session = sessionRepo.findById(id);
      if (!session) return;
      session.setAgentSessionId(agentSessionId);
      sessionRepo.save(session);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    deregister(sessionId: string): void {
      const id = makeSessionId(sessionId);
      const session = sessionRepo.findById(id);
      if (session) {
        session.markEnded(0, false);
        sessionRepo.save(session);
        Effect.runFork(publishEvents(session.pullEvents()));
      }

      const connId = registry.sessionConnections.get(sessionId);
      if (connId) {
        registry.connSessions.delete(connId);
      }
      registry.sessionConnections.delete(sessionId);
    },
  };
}
```

- [ ] **Step 3: Create `modules/agent-session/application/use-cases/session-cleanup.use-case.ts`**

```typescript
import { Effect } from 'effect';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';
import type { SessionId } from '#modules/agent-session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';

interface SessionCleanupDeps {
  sessionRepo: SessionRepositoryShape;
  eventPublisher: EventPublisherShape;
}

export type SessionCleanupShape = ReturnType<typeof createSessionCleanupUseCase>;

export function createSessionCleanupUseCase(deps: SessionCleanupDeps) {
  const { sessionRepo, eventPublisher } = deps;

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  return {
    delete(sessionId: string): void {
      const id = makeSessionId(sessionId);
      const session = sessionRepo.findById(id);
      if (!session) return;
      session.delete();
      sessionRepo.delete(id);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    deleteAllEnded(): void {
      sessionRepo.deleteAllEnded();
      Effect.runFork(eventPublisher.publish({ type: 'sessions:cleared', timestamp: Date.now() }));
    },
  };
}
```

- [ ] **Step 4: Create `modules/agent-session/application/use-cases/terminal-connection.use-case.ts`**

This is the largest use case — it manages CLI and browser channel connections around live PTY handles. It also owns `applyResizePriority`, `setupPtyLifecycle` (used by SpawnSession), and browser-channel management.

```typescript
import { Effect } from 'effect';
import { type LineBuffer, stripAnsiAndBuffer } from '#lib/input-line-buffer';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { TerminalRepositoryShape } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { TerminalSubscribersShape } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';
import type { SessionId } from '#modules/agent-session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type { PtyEntry, PtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';

interface TerminalConnectionDeps {
  sessionRepo: SessionRepositoryShape;
  terminalRepo: TerminalRepositoryShape;
  eventPublisher: EventPublisherShape;
  terminalSubs: TerminalSubscribersShape;
  agentRegistry: AgentRegistryShape;
  resumabilityChecker: ResumabilityCheckerShape;
  registry: PtyRegistry;
  sendToCliClient: (connId: string, msg: string) => void;
}

export type TerminalConnectionShape = ReturnType<typeof createTerminalConnectionUseCase>;

export function createTerminalConnectionUseCase(deps: TerminalConnectionDeps) {
  const {
    sessionRepo,
    terminalRepo,
    eventPublisher,
    terminalSubs,
    agentRegistry,
    resumabilityChecker,
    registry,
    sendToCliClient,
  } = deps;

  const inputLineBuffers = new Map<string, LineBuffer>();

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  function applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
    const entry = registry.ptyHandles.get(sessionId);
    if (!entry) return null;

    let cols: number;
    let rows: number;
    if (entry.browserChannels.size > 0) {
      const first = entry.browserChannels.values().next().value;
      if (!first) return null;
      cols = first.cols;
      rows = first.rows;
    } else if (entry.cliChannels.size > 0) {
      const first = entry.cliChannels.values().next().value;
      if (!first) return null;
      cols = first.cols;
      rows = first.rows - 1;
    } else {
      return null;
    }

    entry.handle.resize(cols, rows);
    entry.ptyDimensions = { cols, rows };

    for (const connId of entry.cliChannels.keys()) {
      sendToCliClient(
        connId,
        JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
      );
    }

    Effect.runFork(
      eventPublisher.publish({ type: 'terminal:pty-resized', sessionId, cols, rows })
    );
    return { cols, rows };
  }

  // Called by SpawnSessionUseCase after creating a PtyEntry
  function setupPtyLifecycle(sessionId: SessionId, entry: PtyEntry): void {
    entry.handle.onOutput((data: Uint8Array) => {
      const base64 = Buffer.from(data).toString('base64');
      const ts = Date.now();
      terminalRepo.appendChunk(sessionId, base64, ts);

      for (const connId of entry.cliChannels.keys()) {
        sendToCliClient(
          connId,
          JSON.stringify({ type: 'session:pty-output', sessionId, data: base64 })
        );
      }

      Effect.runFork(terminalSubs.publish(sessionId, base64));
    });

    Effect.runFork(
      Effect.promise(() => entry.handle.wait()).pipe(
        Effect.flatMap((exitCode) =>
          Effect.sync(() => {
            const session = sessionRepo.findById(sessionId);
            if (!session) return;

            const adapter = agentRegistry.resolve(session.agentType);
            const resumable =
              adapter.canResume &&
              session.agentSessionId != null &&
              resumabilityChecker.isResumable(session.agentSessionId, session.cwd);

            session.markEnded(exitCode, resumable);
            sessionRepo.save(session);
            Effect.runFork(publishEvents(session.pullEvents()));

            for (const connId of entry.cliChannels.keys()) {
              sendToCliClient(
                connId,
                JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode })
              );
            }

            registry.ptyHandles.delete(sessionId);
          })
        )
      )
    );
  }

  return {
    setupPtyLifecycle,

    kill(sessionId: string): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (entry) entry.handle.kill();
    },

    killAll(): void {
      for (const entry of registry.ptyHandles.values()) {
        entry.handle.kill();
      }
    },

    getActivePid(sessionId: string): number | null {
      return registry.ptyHandles.get(sessionId)?.handle.pid ?? null;
    },

    attach(
      sessionId: string,
      connId: string,
      dims: { cols: number; rows: number }
    ): { chunks: Array<{ data: string }>; pid: number } | null {
      const id = makeSessionId(sessionId);
      const entry = registry.ptyHandles.get(id);
      if (!entry) return null;

      const cliRows = dims.rows - 1;
      entry.cliChannels.set(connId, { cols: dims.cols, rows: dims.rows });
      registry.connSessions.set(connId, id);

      entry.handle.resize(dims.cols, cliRows);
      entry.ptyDimensions = { cols: dims.cols, rows: cliRows };

      Effect.runFork(
        eventPublisher.publish({
          type: 'terminal:pty-resized',
          sessionId,
          cols: dims.cols,
          rows: cliRows,
        })
      );

      const chunks = terminalRepo.getAllChunks(sessionId);
      return { chunks, pid: entry.handle.pid };
    },

    detach(sessionId: string, connId: string): void {
      const id = makeSessionId(sessionId);
      const entry = registry.ptyHandles.get(id);
      if (!entry) return;
      entry.cliChannels.delete(connId);
      registry.connSessions.delete(connId);
      applyResizePriority(id);
    },

    updateCliResize(sessionId: string, connId: string, cols: number, rows: number): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (entry?.cliChannels.has(connId)) {
        entry.cliChannels.set(connId, { cols, rows });
        applyResizePriority(sessionId);
      }
    },

    handleDisconnect(connId: string): void {
      const sessionId = registry.connSessions.get(connId);
      if (!sessionId) return;

      const entry = registry.ptyHandles.get(sessionId);
      if (entry) {
        entry.cliChannels.delete(connId);
        registry.connSessions.delete(connId);
        applyResizePriority(sessionId);
      } else {
        const id = makeSessionId(sessionId);
        const session = sessionRepo.findById(id);
        const alreadyEnded = session && (session.status === 'ended' || session.status === 'error');

        if (!alreadyEnded && session) {
          session.markEnded(-1, false);
          sessionRepo.save(session);
          Effect.runFork(publishEvents(session.pullEvents()));
        }

        registry.connSessions.delete(connId);
        registry.sessionConnections.delete(sessionId);
      }
    },

    writeInput(sessionId: string, data: string, source: 'cli' | 'browser'): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return;

      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      entry.handle.write(bytes);

      stripAnsiAndBuffer(inputLineBuffers, sessionId, data, source, (text, src, ts) => {
        terminalRepo.appendInput(sessionId, text, src, ts);
        Effect.runFork(
          eventPublisher.publish({
            type: 'terminal:input-echo',
            sessionId,
            text,
            source: src,
            timestamp: ts,
          })
        );
      });
    },

    applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
      return applyResizePriority(sessionId);
    },

    // Browser channel management (for terminal WS route)
    addBrowserChannel(
      sessionId: string,
      connId: string,
      dims: { cols: number; rows: number }
    ): number | null {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return null;
      entry.browserChannels.set(connId, dims);
      applyResizePriority(sessionId);
      return entry.handle.pid;
    },

    updateBrowserChannel(
      sessionId: string,
      connId: string,
      dims: { cols: number; rows: number }
    ): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return;
      entry.browserChannels.set(connId, dims);
      applyResizePriority(sessionId);
    },

    removeBrowserChannel(sessionId: string, connId: string): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (!entry) return;
      entry.browserChannels.delete(connId);
      applyResizePriority(sessionId);
    },

    writeBinaryInput(sessionId: string, data: Uint8Array): void {
      const entry = registry.ptyHandles.get(sessionId);
      if (entry) {
        entry.handle.write(data);
        const base64 = Buffer.from(data).toString('base64');
        this.writeInput(sessionId, base64, 'browser');
      }
    },
  };
}
```

> **Note:** `terminal-subscribers.ts` will be moved to `agent-session/infrastructure/adapters/out/terminal-subscribers.ts` in Task 5. This import is forward-referenced — it won't resolve until Task 5.

- [ ] **Step 5: Create `modules/agent-session/application/use-cases/check-resumability.use-case.ts`**

```typescript
import { Effect } from 'effect';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';

interface CheckResumabilityDeps {
  sessionRepo: SessionRepositoryShape;
  resumabilityChecker: ResumabilityCheckerShape;
  eventPublisher: EventPublisherShape;
}

export type CheckResumabilityShape = ReturnType<typeof createCheckResumabilityUseCase>;

export function createCheckResumabilityUseCase(deps: CheckResumabilityDeps) {
  const { sessionRepo, resumabilityChecker, eventPublisher } = deps;

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  return {
    checkResumableForActive(): void {
      const activeSessions = sessionRepo.findActiveWithAgentId();
      for (const row of activeSessions) {
        const isResumable = resumabilityChecker.isResumable(row.agentSessionId, row.cwd);
        if (isResumable !== row.resumable) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(isResumable);
            sessionRepo.save(session);
            Effect.runFork(publishEvents(session.pullEvents()));
          }
        }
      }

      const recentlyEnded = sessionRepo.findRecentlyEnded(5 * 60 * 1000);
      for (const row of recentlyEnded) {
        if (resumabilityChecker.isResumable(row.agentSessionId, row.cwd)) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(true);
            sessionRepo.save(session);
            Effect.runFork(publishEvents(session.pullEvents()));
          }
        }
      }
    },
  };
}
```

- [ ] **Step 6: Create `modules/agent-session/application/use-cases/session-queries.use-case.ts`**

```typescript
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { TerminalRepositoryShape } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import type { Session } from '#modules/agent-session/domain/session';
import type { SessionId } from '#modules/agent-session/domain/session-id';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';

interface SessionQueriesDeps {
  sessionRepo: SessionRepositoryShape;
  terminalRepo: TerminalRepositoryShape;
}

export type SessionQueriesShape = ReturnType<typeof createSessionQueriesUseCase>;

export function createSessionQueriesUseCase(deps: SessionQueriesDeps) {
  const { sessionRepo, terminalRepo } = deps;

  return {
    listAll(): Session[] {
      return sessionRepo.findAll();
    },

    findById(sessionId: string): Session | null {
      return sessionRepo.findById(makeSessionId(sessionId));
    },

    getAllChunks(sessionId: string): Array<{ data: string }> {
      return terminalRepo.getAllChunks(sessionId);
    },

    getInputHistory(
      sessionId: string,
      limit?: number
    ): Array<{ text: string; source: string; timestamp: number }> {
      return terminalRepo.getInputHistory(sessionId, limit);
    },
  };
}
```

- [ ] **Step 7: Run typecheck (partial — expect forward-ref errors)**

```bash
cd packages/app && bun run typecheck 2>&1 | head -40
```

Expected: Errors for `terminal-subscribers` import in terminal-connection (not yet moved). All other new use case files should be clean.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/modules/agent-session/application/use-cases/
git commit -m "refactor(agent-session): create 6 use cases extracted from session.service.ts"
```

---

## Task 5: Move agent-session infrastructure adapters

**Files:**
Move (copy + update imports) all files from `session/infrastructure/` and `terminal/infrastructure/` to `agent-session/infrastructure/`. Also move `terminal/application/terminal-subscribers.ts` to `agent-session/infrastructure/adapters/out/terminal-subscribers.ts`.

This is a bulk move. All `#modules/session/...` and `#modules/terminal/...` imports inside these files update to `#modules/agent-session/...`. All `#shared/kernel/session-id` → `#modules/agent-session/domain/session-id`, `#shared/kernel/domain-events` → `#modules/agent-session/domain/events`, `#shared/kernel/pty` → `#modules/agent-session/application/ports/out/pty-spawner.port`.

- [ ] **Step 1: Move terminal-subscribers**

Copy `modules/terminal/application/terminal-subscribers.ts` to `modules/agent-session/infrastructure/adapters/out/terminal-subscribers.ts`. No import changes needed (it has no cross-module imports).

- [ ] **Step 2: Move session infrastructure adapters (in/)**

Copy all files from `modules/session/infrastructure/adapters/in/` to `modules/agent-session/infrastructure/adapters/in/`. For each file:

- `session.dto.ts` — no import changes needed
- `session.mapper.ts` — update: `#modules/session/domain/...` → `#modules/agent-session/domain/...`
- `session.page.tsx` — update: `#modules/session/domain/...` → `#modules/agent-session/domain/...`
- `session.routes.tsx` — **skip this file, handled in Task 7** (it references SessionService which is being replaced)
- `ui/*.tsx`, `ui/*.ts` — update module imports

- [ ] **Step 3: Move session infrastructure adapters (out/)**

Copy all files from `modules/session/infrastructure/adapters/out/` to `modules/agent-session/infrastructure/adapters/out/`. Update imports:

- `sqlite-session-repository.ts`:
  ```typescript
  // Change:
  import type { SessionId } from '#shared/kernel/session-id';
  import { SessionId as makeSessionId } from '#shared/kernel/session-id';
  // To:
  import type { SessionId } from '#modules/agent-session/domain/session-id';
  import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
  ```
  Also update: `#modules/session/application/ports/out/session-repository.port` → `#modules/agent-session/application/ports/out/session-repository.port`
  And: `#modules/session/domain/session` → `#modules/agent-session/domain/session`

- `fs-resumability-checker.ts`:
  Update: `#modules/session/application/ports/out/resumability-checker.port` → `#modules/agent-session/application/ports/out/resumability-checker.port`

- `agents/claude.adapter.ts`:
  Update: `#modules/session/application/ports/out/agent-adapter.port` → `#modules/agent-session/application/ports/out/agent-adapter.port`

- `agents/agent-registry.ts`:
  Update: `#modules/session/application/ports/out/agent-adapter.port` → `#modules/agent-session/application/ports/out/agent-adapter.port`

- `agents/claude-stream-schemas.ts` — no import changes needed

- [ ] **Step 4: Move terminal infrastructure adapters (in/)**

Copy `modules/terminal/infrastructure/adapters/in/browser-events.ts` to `modules/agent-session/infrastructure/adapters/in/browser-events.ts`. No import changes needed.

Copy `modules/terminal/infrastructure/adapters/in/ui/*` to `modules/agent-session/infrastructure/adapters/in/ui/`. Update imports from `#modules/terminal/...` to `#modules/agent-session/...`.

**Skip `terminal.routes.ts`** — handled in Task 7.

- [ ] **Step 5: Move terminal infrastructure adapters (out/)**

Copy all files from `modules/terminal/infrastructure/adapters/out/` to `modules/agent-session/infrastructure/adapters/out/`. Update imports:

- `event-publisher.adapter.ts`:
  ```typescript
  // Change:
  import type { DomainEvent } from '#shared/kernel/domain-events';
  import { EventPublisher, type EventPublisherShape } from '#modules/terminal/application/ports/out/event-publisher.port';
  import type { BrowserEvent } from '#modules/terminal/infrastructure/adapters/in/browser-events';
  // To:
  import type { DomainEvent } from '#modules/agent-session/domain/events';
  import { EventPublisher, type EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
  import type { BrowserEvent } from '#modules/agent-session/infrastructure/adapters/in/browser-events';
  ```

- `bun-pty-spawner.ts`:
  ```typescript
  // Change:
  import { type PtyHandle, PtySpawner, type PtySpawnerShape } from '#modules/terminal/application/ports/out/pty-spawner.port';
  // To:
  import { type PtyHandle, PtySpawner, type PtySpawnerShape } from '#modules/agent-session/application/ports/out/pty-spawner.port';
  ```
  Remove the `#shared/kernel/errors` import — `AgentRunnerError` is still there, keep it.

- `sqlite-terminal-repository.ts`:
  Update: `#modules/terminal/application/ports/out/terminal-repository.port` → `#modules/agent-session/application/ports/out/terminal-repository.port`

- `terminal-gateway.adapter.ts`: **Delete this file** — its functionality is now distributed across `TerminalConnectionUseCase` and individual service calls. Do not copy it.

- `pty/bun-pty.ts` and `pty/native/` — copy verbatim, no import changes.

- [ ] **Step 6: Move terminal-subscribers (event-publisher port usage)**

In `modules/agent-session/infrastructure/adapters/out/terminal-subscribers.ts`, no imports changed needed. Already done in Step 1.

- [ ] **Step 7: Run typecheck**

```bash
cd packages/app && bun run typecheck 2>&1 | grep "error TS" | head -30
```

Expected: Errors about unresolved imports in `terminal-connection.use-case.ts` (the forward-ref to terminal-subscribers is now resolved). Errors about old session/terminal module files that still exist (they reference old locations). New agent-session files should be mostly clean.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/
git commit -m "refactor(agent-session): move session + terminal infrastructure adapters to agent-session"
```

---

## Task 6: Create daemon port interfaces and update daemon errors

**Files:**
- Create: `modules/daemon/application/ports/in/spawn-session.port.ts`
- Create: `modules/daemon/application/ports/in/session-lifecycle.port.ts`
- Create: `modules/daemon/application/ports/in/session-cleanup.port.ts`
- Create: `modules/daemon/application/ports/in/terminal-connection.port.ts`
- Create: `modules/daemon/application/ports/in/session-queries.port.ts`
- Modify: `modules/daemon/application/ports/in/session-command.port.ts` (delete or keep for compatibility)
- Modify: `modules/daemon/infrastructure/adapters/in/ipc-router.ts`
- Modify: `modules/daemon/infrastructure/adapters/in/unix-socket-client.adapter.ts`
- Modify: `modules/daemon/infrastructure/adapters/in/commands/*.command.ts` (update error imports)

Daemon ports use `string` for session IDs (opaque — branding is agent-session's concern). Error types reference daemon/domain/errors.ts directly (no more shared/kernel re-exports).

- [ ] **Step 1: Create `modules/daemon/application/ports/in/spawn-session.port.ts`**

```typescript
import type { Effect } from 'effect';

export interface SpawnResult {
  sessionId: string;
  pid: number;
}

export interface SpawnSessionShape {
  register(props: {
    sessionId: string;
    agentType: string;
    cwd: string;
    mode?: 'prompt' | 'interactive';
    gitBranch?: string;
    gitRemoteUrl?: string;
    repoName?: string;
    connId: string;
  }): void;

  spawnInteractive(props: {
    sessionId?: string;
    agentType: string;
    cwd: string;
    cols: number;
    rows: number;
    connId?: string;
    agentSessionId?: string;
    resume?: boolean;
    gitBranch?: string;
    repoName?: string;
  }): Effect.Effect<SpawnResult, Error>;

  resume(
    sessionId: string,
    opts: { cols: number; rows: number; connId?: string; gitBranch?: string; repoName?: string }
  ): Effect.Effect<SpawnResult, Error>;
}
```

- [ ] **Step 2: Create `modules/daemon/application/ports/in/session-lifecycle.port.ts`**

```typescript
export interface SessionLifecycleShape {
  markEnded(sessionId: string, exitCode: number): void;
  markError(sessionId: string, error: string): void;
  setAgentSessionId(sessionId: string, agentSessionId: string): void;
  deregister(sessionId: string): void;
}
```

- [ ] **Step 3: Create `modules/daemon/application/ports/in/session-cleanup.port.ts`**

```typescript
export interface SessionCleanupShape {
  delete(sessionId: string): void;
  deleteAllEnded(): void;
}
```

- [ ] **Step 4: Create `modules/daemon/application/ports/in/terminal-connection.port.ts`**

```typescript
export interface AttachResult {
  chunks: Array<{ data: string }>;
  pid: number;
}

export interface TerminalConnectionShape {
  kill(sessionId: string): void;
  killAll(): void;
  attach(sessionId: string, connId: string, dims: { cols: number; rows: number }): AttachResult | null;
  detach(sessionId: string, connId: string): void;
  updateCliResize(sessionId: string, connId: string, cols: number, rows: number): void;
  handleDisconnect(connId: string): void;
  writeInput(sessionId: string, data: string, source: 'cli' | 'browser'): void;
  applyResizePriority(sessionId: string): { cols: number; rows: number } | null;
  addBrowserChannel(sessionId: string, connId: string, dims: { cols: number; rows: number }): number | null;
  updateBrowserChannel(sessionId: string, connId: string, dims: { cols: number; rows: number }): void;
  removeBrowserChannel(sessionId: string, connId: string): void;
  writeBinaryInput(sessionId: string, data: Uint8Array): void;
}
```

- [ ] **Step 5: Create `modules/daemon/application/ports/in/session-queries.port.ts`**

```typescript
export interface SessionInfo {
  id: string;
  agentType: string;
  status: string;
  cwd: string;
  pid?: number;
  gitBranch?: string;
  repoName?: string;
  resumable?: boolean;
  agentSessionId?: string;
  canResume?: boolean;
  canDelete?: boolean;
}

export interface SessionQueriesShape {
  listAll(): SessionInfo[];
  findById(sessionId: string): SessionInfo | null;
  getAllChunks(sessionId: string): Array<{ data: string }>;
  getInputHistory(sessionId: string, limit?: number): Array<{ text: string; source: string; timestamp: number }>;
}
```

> **Note:** `SessionInfo` is a DTO mapped from the agent-session `Session` domain object at the composition boundary. The daemon never imports the `Session` class directly.

- [ ] **Step 6: Delete or hollow out `session-command.port.ts`**

The old `SessionCommandShape` is replaced by the split ports above. Delete the file:

```bash
rm packages/app/src/modules/daemon/application/ports/in/session-command.port.ts
```

- [ ] **Step 7: Update daemon CLI command files to use new error import**

Files that import from `#shared/kernel/errors` for daemon errors (`DaemonNotRunningError`, `IpcConnectionError`):
- `modules/daemon/infrastructure/adapters/in/unix-socket-client.adapter.ts`
- `modules/daemon/infrastructure/adapters/in/pty-relay.ts`
- `modules/daemon/infrastructure/adapters/in/commands/claude-interactive.command.ts`
- `modules/daemon/infrastructure/adapters/in/commands/session-attach.command.ts`
- `modules/daemon/infrastructure/adapters/in/commands/session-resume.command.ts`
- `modules/daemon/infrastructure/adapters/in/commands/claude.command.ts`

In each file, change:
```typescript
import { DaemonNotRunningError } from '#shared/kernel/errors';
// or
import { IpcConnectionError } from '#shared/kernel/errors';
```
to:
```typescript
import { DaemonNotRunningError } from '#modules/daemon/domain/errors';
// or
import { IpcConnectionError } from '#modules/daemon/domain/errors';
```

- [ ] **Step 8: Remove `| never` redundant union from RouteError types**

In `modules/daemon/infrastructure/adapters/in/fs.routes.ts` (and any other route files with this pattern):

```typescript
// Change:
type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError | never;
// To:
type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;
```

- [ ] **Step 9: Run typecheck**

```bash
cd packages/app && bun run typecheck 2>&1 | grep "error TS" | head -30
```

Expected: Errors about missing `session-command.port.ts` (callers not updated yet), old session/terminal module references. New port files should be clean.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/modules/daemon/application/ports/ packages/app/src/modules/daemon/domain/ packages/app/src/modules/daemon/infrastructure/adapters/in/
git commit -m "refactor(daemon): split SessionCommandShape into focused port interfaces, own daemon errors"
```

---

## Task 7: Update daemon HTTP routes and IPC router

**Files:**
- Create: `modules/agent-session/infrastructure/adapters/in/session.routes.tsx` (replace old version)
- Create: `modules/agent-session/infrastructure/adapters/in/terminal.routes.ts` (replace old version)
- Modify: `modules/daemon/infrastructure/adapters/in/ipc-router.ts`

Routes accept specific use case shapes instead of `SessionService`. The `SessionInfo` DTO replaces the `Session` domain object in routes (daemon doesn't import agent-session domain).

- [ ] **Step 1: Create `modules/agent-session/infrastructure/adapters/in/session.routes.tsx`**

This replaces the old session.routes.tsx. It accepts the split use case shapes:

```typescript
import { homedir as homedirFn } from 'node:os';
import { Effect } from 'effect';
import * as Schema from 'effect/Schema';

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import * as v from 'valibot';
import { renderPage } from '#infra/ssr/render-page';
import type { SpawnSessionShape } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import type { SessionCleanupShape } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { TerminalConnectionShape } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { SpawnSessionRequestSchema } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { expandPath } from '#shared/lib/path';
import { sessionToDTO } from './session.mapper';
import { DashboardPage } from './session.page';

type SessionRouteDeps = {
  spawnSession: SpawnSessionShape;
  sessionCleanup: SessionCleanupShape;
  sessionQueries: SessionQueriesShape;
  terminalConnection: TerminalConnectionShape;
  eventPublisher: {
    subscribeBrowser: (listener: (event: unknown) => void) => () => void;
  };
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

const jsonRoute = <E,>(
  method: 'GET' | 'POST' | 'DELETE',
  path: HttpRouter.PathInput,
  handler: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | HttpRouter.RouteContext
  >
) =>
  HttpRouter.route(
    method,
    path,
    handler.pipe(
      Effect.catch((err) =>
        Effect.succeed(
          HttpServerResponse.jsonUnsafe(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          )
        )
      )
    )
  );

export function createSessionRoutes(deps: SessionRouteDeps): HttpRouter.Route<RouteError, never>[] {
  const { spawnSession, sessionCleanup, sessionQueries, terminalConnection, eventPublisher } = deps;

  return [
    HttpRouter.route(
      'GET',
      '/',
      Effect.gen(function* () {
        const sessions = sessionQueries.listAll().map(sessionToDTO);
        return yield* renderPage(<DashboardPage sessions={sessions} homedir={homedirFn()} />, {
          title: 'vigie',
        });
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/create',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = yield* request.text;
        const params = new URLSearchParams(body);
        const cwd = expandPath(params.get('cwd') ?? '~');
        const agentType = params.get('agentType') ?? 'claude';
        yield* spawnSession
          .spawnInteractive({ agentType, cwd, cols: 220, rows: 50 })
          .pipe(Effect.catch(() => Effect.void));
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/:id/kill',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) return HttpServerResponse.redirect('/');
        terminalConnection.kill(sessionId);
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/:id/resume',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) return HttpServerResponse.redirect('/');
        yield* spawnSession
          .resume(sessionId, { cols: 220, rows: 50 })
          .pipe(Effect.catch(() => Effect.void));
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/:id/delete',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) return HttpServerResponse.redirect('/');
        const session = sessionQueries.findById(sessionId);
        if (session?.canDelete) {
          sessionCleanup.delete(sessionId);
        }
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/clear-ended',
      Effect.sync(() => {
        sessionCleanup.deleteAllEnded();
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'POST',
      '/sessions/kill-all',
      Effect.sync(() => {
        terminalConnection.killAll();
        return HttpServerResponse.redirect('/');
      })
    ),

    HttpRouter.route(
      'GET',
      '/api/health',
      HttpServerResponse.jsonUnsafe({ status: 'ok', pid: process.pid })
    ),

    HttpRouter.route(
      'GET',
      '/api/sessions',
      Effect.sync(() => {
        const sessions = sessionQueries.listAll().map(sessionToDTO);
        return HttpServerResponse.jsonUnsafe({ sessions });
      })
    ),

    jsonRoute(
      'POST',
      '/api/sessions',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const raw = yield* request.json;
        const parsed = v.safeParse(SpawnSessionRequestSchema, raw);
        if (!parsed.success) {
          return HttpServerResponse.jsonUnsafe({ error: 'Invalid request body' }, { status: 400 });
        }
        const body = parsed.output;
        const result = yield* spawnSession.spawnInteractive({
          agentType: body.agentType ?? 'claude',
          cwd: expandPath(body.cwd ?? '~'),
          cols: body.cols ?? 120,
          rows: body.rows ?? 30,
        });
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/:id/kill',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const pid = terminalConnection.getActivePid(sessionId);
        if (pid === null) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Session not found or not active' },
            { status: 404 }
          );
        }
        terminalConnection.kill(sessionId);
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    jsonRoute(
      'POST',
      '/api/sessions/:id/resume',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const session = sessionQueries.findById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (!session.canResume) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'This session cannot be resumed' },
            { status: 400 }
          );
        }

        let cols = 120;
        let rows = 30;
        const request = yield* HttpServerRequest.HttpServerRequest;
        yield* Effect.gen(function* () {
          const body = (yield* request.json) as { cols?: number; rows?: number };
          if (typeof body.cols === 'number') cols = body.cols;
          if (typeof body.rows === 'number') rows = body.rows;
        }).pipe(Effect.catch(() => Effect.void));

        const result = yield* spawnSession.resume(sessionId, { cols, rows });
        return HttpServerResponse.jsonUnsafe({ sessionId: result.sessionId });
      })
    ),

    HttpRouter.route(
      'DELETE',
      '/api/sessions/:id',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const session = sessionQueries.findById(sessionId);
        if (!session) {
          return HttpServerResponse.jsonUnsafe({ error: 'Session not found' }, { status: 404 });
        }
        if (!session.canDelete) {
          return HttpServerResponse.jsonUnsafe(
            { error: 'Cannot delete an active session' },
            { status: 400 }
          );
        }
        sessionCleanup.delete(sessionId);
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/clear-ended',
      Effect.sync(() => {
        sessionCleanup.deleteAllEnded();
        return HttpServerResponse.jsonUnsafe({ ok: true });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/sessions/kill-all',
      Effect.gen(function* () {
        terminalConnection.killAll();
        return HttpServerResponse.jsonUnsafe({ killedCount: -1 }); // count not tracked
      })
    ),

    HttpRouter.route(
      'GET',
      '/ws/events',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;

        yield* Effect.logInfo('[server] Events WS client connected');

        const sessions = sessionQueries.listAll().map(sessionToDTO);
        const snapshotMsg = encodeJson({ type: 'snapshot', sessions });
        yield* write(snapshotMsg);

        const services = yield* Effect.services();
        const unsub = eventPublisher.subscribeBrowser((event) => {
          Effect.runForkWith(services)(write(encodeJson(event)));
        });

        yield* socket.runRaw(() => {});
        unsub();

        return HttpServerResponse.empty();
      })
    ),
  ];
}
```

> **Note on `sessionToDTO`:** The `session.mapper.ts` currently maps a `Session` domain object. After this refactor, `sessionQueries.listAll()` returns `Session` objects (agent-session domain objects). The routes file imports `sessionToDTO` from the local `session.mapper.ts` (which lives in the same `agent-session/infrastructure/adapters/in/` folder). This is fine — the mapper is infrastructure code in agent-session.

- [ ] **Step 2: Create `modules/agent-session/infrastructure/adapters/in/terminal.routes.ts`**

```typescript
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type * as Socket from 'effect/unstable/socket/Socket';
import type { SessionQueriesShape } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import type { TerminalConnectionShape } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import type { TerminalSubscribersShape } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';

type TerminalRouteDeps = {
  sessionQueries: SessionQueriesShape;
  terminalConnection: TerminalConnectionShape;
  terminalSubs: TerminalSubscribersShape;
};

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

export function createTerminalRoutes(
  deps: TerminalRouteDeps
): HttpRouter.Route<RouteError, never>[] {
  const { sessionQueries, terminalConnection, terminalSubs } = deps;

  return [
    HttpRouter.route(
      'GET',
      '/api/sessions/:id/chunks',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const chunks = sessionQueries.getAllChunks(sessionId);
        return HttpServerResponse.jsonUnsafe({ chunks });
      })
    ),

    HttpRouter.route(
      'GET',
      '/api/sessions/:id/input-history',
      Effect.gen(function* () {
        const { id: sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }
        const request = yield* HttpServerRequest.HttpServerRequest;
        const url = new URL(request.url, 'http://localhost');
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? Number.parseInt(limitParam, 10) : 200;
        const history = sessionQueries.getInputHistory(sessionId, limit);
        return HttpServerResponse.jsonUnsafe({ history });
      })
    ),

    HttpRouter.route(
      'GET',
      '/ws/terminal/:sessionId',
      Effect.gen(function* () {
        const { sessionId } = yield* HttpRouter.params;
        if (!sessionId) {
          return HttpServerResponse.jsonUnsafe({ error: 'Missing session ID' }, { status: 400 });
        }

        const request = yield* HttpServerRequest.HttpServerRequest;
        const socket = yield* request.upgrade;
        const write = yield* socket.writer;
        const browserConnId = crypto.randomUUID();

        yield* Effect.logInfo(`[server] Terminal WS client connected for session ${sessionId}`);

        const chunks = sessionQueries.getAllChunks(sessionId);
        for (const chunk of chunks) {
          const payload = Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0));
          yield* write(payload);
        }

        terminalConnection.addBrowserChannel(sessionId, browserConnId, { cols: 120, rows: 30 });

        const services = yield* Effect.services();
        const unsub = terminalSubs.subscribe(sessionId, (data: string) => {
          const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          Effect.runForkWith(services)(write(payload));
        });

        yield* socket.runRaw((message) => {
          if (typeof message === 'string') {
            try {
              const parsed = JSON.parse(message) as {
                type?: string;
                cols?: number;
                rows?: number;
              };
              if (
                parsed.type === 'resize' &&
                typeof parsed.cols === 'number' &&
                typeof parsed.rows === 'number'
              ) {
                terminalConnection.updateBrowserChannel(sessionId, browserConnId, {
                  cols: parsed.cols,
                  rows: parsed.rows,
                });
              }
            } catch {}
          } else if (message.length > 0) {
            terminalConnection.writeBinaryInput(sessionId, message);
          }
        });

        unsub();
        terminalConnection.removeBrowserChannel(sessionId, browserConnId);

        return HttpServerResponse.empty();
      })
    ),
  ];
}
```

- [ ] **Step 3: Update `modules/daemon/infrastructure/adapters/in/ipc-router.ts`**

Replace the current implementation that takes `SessionCommandShape` with one that takes split use case shapes:

```typescript
import { Effect } from 'effect';
import * as Schema from 'effect/Schema';
import type { SpawnSessionShape } from '#modules/daemon/application/ports/in/spawn-session.port';
import type { SessionLifecycleShape } from '#modules/daemon/application/ports/in/session-lifecycle.port';
import type { TerminalConnectionShape } from '#modules/daemon/application/ports/in/terminal-connection.port';
import type { IpcConnection } from '#modules/daemon/application/ports/out/ipc-server.port';
import type { SessionToDaemon } from '#shared/kernel/ipc-protocol';
import { expandPath } from '#shared/lib/path';

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

interface IpcRouterDeps {
  spawnSession: SpawnSessionShape;
  sessionLifecycle: SessionLifecycleShape;
  terminalConnection: TerminalConnectionShape;
}

export function createIpcRouter(
  deps: IpcRouterDeps
): (conn: IpcConnection, msg: SessionToDaemon) => Effect.Effect<void> {
  const { spawnSession, sessionLifecycle, terminalConnection } = deps;

  return (conn, msg) =>
    Effect.gen(function* () {
      switch (msg.type) {
        case 'session:register': {
          spawnSession.register({
            sessionId: msg.sessionId,
            agentType: msg.agentType,
            cwd: msg.cwd,
            mode: msg.mode as 'prompt' | 'interactive' | undefined,
            gitBranch: msg.gitBranch,
            gitRemoteUrl: msg.gitRemoteUrl,
            repoName: msg.repoName,
            connId: conn.id,
          });
          conn.send(encodeJson({ type: 'session:registered', sessionId: msg.sessionId }));
          break;
        }
        case 'session:spawn-interactive': {
          const spawnResult = yield* Effect.result(
            spawnSession.spawnInteractive({
              sessionId: msg.sessionId,
              agentType: msg.agentType,
              cwd: expandPath(msg.cwd),
              cols: msg.cols,
              rows: msg.rows - 1,
              connId: conn.id,
              agentSessionId: msg.sessionId,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
            })
          );

          if (spawnResult._tag === 'Failure') {
            const err = spawnResult.failure;
            conn.send(
              encodeJson({
                type: 'session:spawn-failed',
                sessionId: msg.sessionId,
                error: err instanceof Error ? err.message : String(err),
              })
            );
            break;
          }

          const { sessionId, pid } = spawnResult.success;
          conn.send(encodeJson({ type: 'session:spawned', sessionId, pid }));
          break;
        }
        case 'session:stdin': {
          terminalConnection.writeInput(msg.sessionId, msg.data, 'cli');
          break;
        }
        case 'session:cli-resize': {
          terminalConnection.updateCliResize(msg.sessionId, conn.id, msg.cols, msg.rows);
          yield* Effect.logInfo(
            `[daemon] cli-resize sessionId=${msg.sessionId} cols=${msg.cols} rows=${msg.rows}`
          );
          break;
        }
        case 'session:detach': {
          terminalConnection.detach(msg.sessionId, conn.id);
          break;
        }
        case 'session:attach': {
          const result = terminalConnection.attach(msg.sessionId, conn.id, {
            cols: msg.cols,
            rows: msg.rows,
          });
          if (result) {
            conn.send(
              encodeJson({
                type: 'session:spawned',
                sessionId: msg.sessionId,
                pid: result.pid,
                ptyCols: msg.cols,
                ptyRows: msg.rows - 1,
                forcedResize: true,
              })
            );
            for (const chunk of result.chunks) {
              conn.send(
                encodeJson({ type: 'session:pty-output', sessionId: msg.sessionId, data: chunk.data })
              );
            }
            conn.send(encodeJson({ type: 'session:replay-complete', sessionId: msg.sessionId }));
            yield* Effect.logInfo(
              `[daemon] CLI attached to session ${msg.sessionId} (replayed ${result.chunks.length} chunks)`
            );
          } else {
            conn.send(
              encodeJson({
                type: 'session:spawn-failed',
                sessionId: msg.sessionId,
                error: 'Session not found or PTY not running',
              })
            );
          }
          break;
        }
        case 'session:output':
        case 'session:terminal-output': {
          break;
        }
        case 'session:done': {
          sessionLifecycle.markEnded(msg.sessionId, msg.exitCode);
          yield* Effect.logInfo(`[daemon] Session done: ${msg.sessionId} (exit ${msg.exitCode})`);
          break;
        }
        case 'session:error': {
          sessionLifecycle.markError(msg.sessionId, msg.error);
          yield* Effect.logError(`[daemon] Session error: ${msg.sessionId}: ${msg.error}`);
          break;
        }
        case 'session:resume': {
          const resumeResult = yield* Effect.result(
            spawnSession.resume(msg.sessionId, {
              cols: msg.cols,
              rows: msg.rows,
              connId: conn.id,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
            })
          );

          if (resumeResult._tag === 'Failure') {
            const err = resumeResult.failure;
            conn.send(
              encodeJson({
                type: 'session:spawn-failed',
                sessionId: msg.sessionId,
                error: err instanceof Error ? err.message : String(err),
              })
            );
            break;
          }

          const { sessionId: resumedId, pid: resumedPid } = resumeResult.success;
          conn.send(encodeJson({ type: 'session:spawned', sessionId: resumedId, pid: resumedPid }));
          break;
        }
        case 'session:agent-id': {
          sessionLifecycle.setAgentSessionId(msg.sessionId, msg.agentSessionId);
          yield* Effect.logInfo(
            `[daemon] Agent session ID detected for ${msg.sessionId}: ${msg.agentSessionId}`
          );
          break;
        }
        case 'session:deregister': {
          sessionLifecycle.deregister(msg.sessionId);
          break;
        }
      }
    });
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd packages/app && bun run typecheck 2>&1 | grep "error TS" | head -40
```

Expected: Errors about `daemon/main.ts` which still imports old `SessionServiceTag`. New route and IPC router files should be clean.

- [ ] **Step 5: Run existing tests**

```bash
cd packages/app && bun test 2>&1 | tail -20
```

Expected: Tests that import old module paths will fail. Domain tests and schema tests should still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/modules/agent-session/infrastructure/adapters/in/ packages/app/src/modules/daemon/infrastructure/adapters/in/ipc-router.ts
git commit -m "refactor(routes): update session + terminal routes and IPC router to use split use cases"
```

---

## Task 8: Create agent-session/dependencies.ts

**Files:**
- Create: `modules/agent-session/dependencies.ts`

This file wires all agent-session layers: creates the PtyRegistry, instantiates all use cases, and exports a single `AgentSessionLayer` that provides all use cases to consumers.

- [ ] **Step 1: Create `modules/agent-session/dependencies.ts`**

```typescript
import { Effect, Layer, ServiceMap } from 'effect';
import {
  AgentRegistry,
} from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
import { EventPublisher } from '#modules/agent-session/application/ports/out/event-publisher.port';
import { PtySpawner } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import { ResumabilityChecker } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import { SessionRepository } from '#modules/agent-session/application/ports/out/session-repository.port';
import { TerminalRepository } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import { TerminalSubscribers } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import { createPtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';
import {
  createSpawnSessionUseCase,
  type SpawnSessionShape,
} from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import {
  createSessionLifecycleUseCase,
  type SessionLifecycleShape,
} from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import {
  createSessionCleanupUseCase,
  type SessionCleanupShape,
} from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import {
  createTerminalConnectionUseCase,
  type TerminalConnectionShape,
} from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import {
  createCheckResumabilityUseCase,
  type CheckResumabilityShape,
} from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import {
  createSessionQueriesUseCase,
  type SessionQueriesShape,
} from '#modules/agent-session/application/use-cases/session-queries.use-case';

// ── Service tags for each use case ─────────────────────────────────────────

export class SpawnSessionTag extends ServiceMap.Service<SpawnSessionTag, SpawnSessionShape>()(
  '@vigie/SpawnSession'
) {}

export class SessionLifecycleTag extends ServiceMap.Service<SessionLifecycleTag, SessionLifecycleShape>()(
  '@vigie/SessionLifecycle'
) {}

export class SessionCleanupTag extends ServiceMap.Service<SessionCleanupTag, SessionCleanupShape>()(
  '@vigie/SessionCleanup'
) {}

export class TerminalConnectionTag extends ServiceMap.Service<TerminalConnectionTag, TerminalConnectionShape>()(
  '@vigie/TerminalConnection'
) {}

export class CheckResumabilityTag extends ServiceMap.Service<CheckResumabilityTag, CheckResumabilityShape>()(
  '@vigie/CheckResumability'
) {}

export class SessionQueriesTag extends ServiceMap.Service<SessionQueriesTag, SessionQueriesShape>()(
  '@vigie/SessionQueries'
) {}

// ── Agent-session module layer ───────────────────────────────────────────────
//
// Requires: SessionRepository, TerminalRepository, PtySpawner, AgentRegistry,
//           ResumabilityChecker, EventPublisher, TerminalSubscribers, IpcServer
// (IpcServer is needed for sendToCliClient — injected at root composition level)
//
// Usage: provided via AgentSessionLayer in src/dependencies.ts

export const AgentSessionUseCasesLayer = Layer.effect(
  // Use a combined service tag to hold all 6 use cases at once
  // We create them together to share PtyRegistry
  TerminalConnectionTag
)(
  Effect.gen(function* () {
    const sessionRepo = yield* SessionRepository;
    const terminalRepo = yield* TerminalRepository;
    const ptySpawner = yield* PtySpawner;
    const agentRegistry = yield* AgentRegistry;
    const resumabilityChecker = yield* ResumabilityChecker;
    const eventPublisher = yield* EventPublisher;
    const terminalSubs = yield* TerminalSubscribers;

    const registry = createPtyRegistry();

    // TerminalConnectionUseCase must be created first (provides setupPtyLifecycle to SpawnSession)
    const terminalConnectionUseCase = createTerminalConnectionUseCase({
      sessionRepo,
      terminalRepo,
      eventPublisher,
      terminalSubs,
      agentRegistry,
      resumabilityChecker,
      registry,
      sendToCliClient: () => {
        throw new Error('sendToCliClient not wired — inject at root dependencies.ts');
      },
    });

    return terminalConnectionUseCase;
  })
);
```

> **Note:** The `sendToCliClient` callback cannot be wired here because it comes from `IpcServer` which lives in the daemon module. This is why the spec says `src/dependencies.ts` (root) wires the event adaptation. The actual `AgentSessionLayer` in `src/dependencies.ts` will create all use cases with the correct `sendToCliClient` from the IpcServer.

Revise `dependencies.ts` to a simpler pure-factory approach (no Effect layers for use cases — they're plain objects created in `src/dependencies.ts`):

```typescript
// modules/agent-session/dependencies.ts
// Re-exports infrastructure layers only. Use cases are created in src/dependencies.ts
// because they need sendToCliClient from daemon's IpcServer.

export {
  AppEventPublisherTag,
  EventPublisherLayer,
} from '#modules/agent-session/infrastructure/adapters/out/event-publisher.adapter';

export { BunPtySpawnerLayer } from '#modules/agent-session/infrastructure/adapters/out/bun-pty-spawner';
export { FsResumabilityCheckerLayer } from '#modules/agent-session/infrastructure/adapters/out/fs-resumability-checker';
export { AgentRegistryLayer } from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
export { TerminalSubscribersLayer } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
export { SqliteSessionRepositoryLayer } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
export { SqliteTerminalRepositoryLayer } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
export { createPtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';
export { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
export { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
export { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
export { createTerminalConnectionUseCase } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
export { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
export { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
export { createSessionRoutes } from '#modules/agent-session/infrastructure/adapters/in/session.routes';
export { createTerminalRoutes } from '#modules/agent-session/infrastructure/adapters/in/terminal.routes';
```

- [ ] **Step 2: Run typecheck**

```bash
cd packages/app && bun run typecheck 2>&1 | grep "error TS" | head -30
```

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/modules/agent-session/dependencies.ts
git commit -m "refactor(agent-session): add dependencies.ts exporting infrastructure layers and use case factories"
```

---

## Task 9: Create daemon/dependencies.ts and run-daemon use case

**Files:**
- Create: `modules/daemon/dependencies.ts`
- Create: `modules/daemon/application/use-cases/run-daemon.use-case.ts`

The `runDaemon` Effect moves from `modules/daemon/main.ts` to a proper use case file. `daemon/dependencies.ts` exports daemon-specific layers.

- [ ] **Step 1: Create `modules/daemon/application/use-cases/run-daemon.use-case.ts`**

Extract the `runDaemon` Effect from `modules/daemon/main.ts`. It will now accept use cases as Effect services rather than direct service tags:

```typescript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Duration, Effect, Fiber, Layer, Schedule } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { VigiDatabase } from '#infra/database';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';
import type { CheckResumabilityShape } from '#modules/daemon/application/ports/in/check-resumability.port';
import type { SpawnSessionShape } from '#modules/daemon/application/ports/in/spawn-session.port';
import type { SessionLifecycleShape } from '#modules/daemon/application/ports/in/session-lifecycle.port';
import type { TerminalConnectionShape } from '#modules/daemon/application/ports/in/terminal-connection.port';
import type { SessionQueriesShape } from '#modules/daemon/application/ports/in/session-queries.port';
import type { SessionCleanupShape } from '#modules/daemon/application/ports/in/session-cleanup.port';
import { SessionRepository } from '#modules/daemon/application/ports/out/session-repository-ref.port';
import type { AppEventPublisher } from '#modules/daemon/application/ports/out/app-event-publisher.port';

// These service tags are provided by src/dependencies.ts
import { SpawnSessionTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { SessionLifecycleTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { TerminalConnectionTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { CheckResumabilityTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { SessionQueriesTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { SessionCleanupTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { AppEventPublisherTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { SessionRepositoryTag } from '#modules/daemon/application/ports/in/use-case-tags';
import { TerminalSubscribersTag } from '#modules/daemon/application/ports/in/use-case-tags';
```

> **Wait — this is getting complicated.** The `runDaemon` use case needs access to many services. In the current code, it uses Effect.gen + `yield*` for services. Under the new design, the use cases are plain objects (not Effect services). So `runDaemon` can't `yield*` a use case.

**Revised approach for `run-daemon.use-case.ts`:** Instead of using Effect service tags, `runDaemon` is a factory function that accepts all use cases as plain deps:

```typescript
// modules/daemon/application/use-cases/run-daemon.use-case.ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Duration, Effect, Fiber, Schedule } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { VigiDatabase } from '#infra/database';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { SessionRepository } from '#modules/agent-session/application/ports/out/session-repository.port';
```

> **Wait — daemon importing from agent-session violates boundaries!**

This is the fundamental tension. The `runDaemon` use case currently needs:
- `SessionRepository` (to call `markOrphanedEnded()`, `pruneOld()`, `findAll()`)
- `ResumabilityChecker`
- Use cases (SpawnSession for `checkResumableForActive`, etc.)

Under the hexagonal spec, `runDaemon` lives in daemon. If it calls session-domain methods, it's crossing a boundary.

**Resolution:** The spec says `runDaemon` belongs in `daemon/application/use-cases/`. The startup cleanup and prune jobs should be part of daemon's use of the `SessionCommandShape` port — or the cleanup should be triggered through agent-session's ports.

Looking at the current `runDaemon`:
1. `sessionRepo.markOrphanedEnded()` + `pruneOld()` → startup cleanup
2. For each session, update resumability → `checkResumability.checkResumableForActive()`
3. Start prune fiber → periodic `sessionRepo.pruneOld()`
4. Start resumability fiber → periodic `checkResumability.checkResumableForActive()`

Solution: Add a `SessionCommandShape`-compatible port in daemon for "startup ops":
```typescript
// daemon/application/ports/in/startup-ops.port.ts
export interface StartupOpsShape {
  cleanupOrphanedSessions(): void;
  pruneOldSessions(): void;
  syncResumabilityOnStartup(): void;
  checkResumableForActive(): void;
}
```

The composition root wires these to the actual session repo + resumability checker from agent-session.

**For the plan's purposes:** `runDaemon` stays close to its current structure but takes an `AgentSessionOps` interface (provided from composition root) for startup operations. The key boundary insight: `runDaemon` calls an opaque interface, never imports from agent-session.

- [ ] **Step 1 (revised): Create `modules/daemon/application/ports/in/startup-ops.port.ts`**

```typescript
export interface StartupOpsShape {
  cleanupOrphanedSessions(): void;
  pruneOldSessions(): void;
  checkResumableForAll(): void;
  checkResumableForActive(): void;
}
```

- [ ] **Step 2: Create `modules/daemon/application/use-cases/run-daemon.use-case.ts`**

```typescript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Duration, Effect, Fiber, Schedule } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { VigiDatabase } from '#infra/database';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';
import { createIpcRouter } from '#modules/daemon/infrastructure/adapters/in/ipc-router';
import type { StartupOpsShape } from '#modules/daemon/application/ports/in/startup-ops.port';
import type { SpawnSessionShape } from '#modules/daemon/application/ports/in/spawn-session.port';
import type { SessionLifecycleShape } from '#modules/daemon/application/ports/in/session-lifecycle.port';
import type { TerminalConnectionShape } from '#modules/daemon/application/ports/in/terminal-connection.port';

interface RunDaemonDeps {
  startupOps: StartupOpsShape;
  spawnSession: SpawnSessionShape;
  sessionLifecycle: SessionLifecycleShape;
  terminalConnection: TerminalConnectionShape;
  appRoutes: ReturnType<typeof createRoutesLayer>;
  cleanup: () => void;
}

export function createRunDaemon(deps: RunDaemonDeps): Effect.Effect<never, never, DaemonConfig | VigiDatabase | IpcServer> {
  const { startupOps, spawnSession, sessionLifecycle, terminalConnection, cleanup } = deps;

  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const db = yield* VigiDatabase;
    const ipcServer = yield* IpcServer;

    mkdirSync(config.vigieHome, { recursive: true, mode: 0o700 });
    writeFileSync(config.pidFile, `${process.pid}\n${Date.now()}`);
    yield* Effect.logInfo(`[daemon] Started (pid ${process.pid})`);

    // Startup cleanup
    startupOps.cleanupOrphanedSessions();
    startupOps.pruneOldSessions();
    startupOps.checkResumableForAll();

    yield* Effect.logInfo('[daemon] SQLite database opened, orphaned sessions cleaned up');

    const pruneFiber = yield* Effect.forkDetach(
      Effect.repeat(
        Effect.gen(function* () {
          startupOps.pruneOldSessions();
          yield* Effect.logInfo('[daemon] Pruned old sessions');
        }),
        Schedule.spaced(Duration.hours(1))
      )
    );

    const resumableFiber = yield* Effect.forkDetach(
      Effect.repeat(
        Effect.sync(() => startupOps.checkResumableForActive()),
        Schedule.spaced(Duration.seconds(5))
      )
    );

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Effect.logInfo('[daemon] Shutting down...');
        yield* Fiber.interrupt(pruneFiber);
        yield* Fiber.interrupt(resumableFiber);
        db.close();
        cleanup();
      })
    );

    // HTTP + WebSocket server
    const clientDistCandidates = [
      join(dirname(process.execPath), 'client'),
      resolve(import.meta.dir, '..', '..', '..', '..', '..', 'dist', 'client'),
    ];
    const clientDistPath = clientDistCandidates.find((p) => existsSync(p));
    if (clientDistPath) {
      yield* Effect.logInfo(`[daemon] Serving client islands from ${clientDistPath}`);
    }

    const routesLayer = deps.appRoutes;
    const port = config.port;

    yield* Effect.gen(function* () {
      const httpEffect = yield* HttpRouter.toHttpEffect(routesLayer);
      const server = yield* BunHttpServer.make({ port });
      yield* server.serve(httpEffect, HttpMiddleware.cors());
    }).pipe(
      Effect.provide(BunHttpServer.layerHttpServices),
      Effect.catchDefect((defect) =>
        Effect.gen(function* () {
          const msg = defect instanceof Error ? defect.message : String(defect);
          if (msg.includes('EADDRINUSE') || msg.includes('address already in use')) {
            yield* Effect.logError(
              `[daemon] Port ${port} is already in use. Is another vigie daemon running? Stop it with: vigie daemon stop`
            );
          } else {
            yield* Effect.logError('[daemon] HTTP server failed to start:', msg);
          }
          cleanup();
          process.exit(1);
        })
      )
    );

    writeFileSync(config.portFile, String(port));
    yield* Effect.logInfo(`[daemon] HTTP + WebSocket server listening on http://localhost:${port}`);

    // IPC Server
    if (existsSync(config.socketPath)) Bun.file(config.socketPath);
    if (existsSync(config.stdinSocketPath)) Bun.file(config.stdinSocketPath);

    const router = createIpcRouter({ spawnSession, sessionLifecycle, terminalConnection });
    yield* ipcServer.start(config.socketPath, router, (connId) =>
      Effect.sync(() => terminalConnection.handleDisconnect(connId))
    );

    yield* Effect.logInfo(`[daemon] IPC server listening on ${config.socketPath}`);

    // Stdin socket (for vigie claude piped input)
    Bun.listen({
      unix: config.stdinSocketPath,
      socket: {
        data(_socket, raw) {
          const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let parsed: { sessionId?: string; data?: string };
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              continue;
            }
            if (parsed.sessionId && parsed.data) {
              terminalConnection.writeInput(parsed.sessionId, parsed.data, 'cli');
            }
          }
        },
        open() {},
        close() {},
        error(_socket, err) {
          console.error(`[stdin-server] error: ${err.message}`);
        },
      },
    });
    yield* Effect.logInfo(`[daemon] Stdin socket listening on ${config.stdinSocketPath}`);

    return yield* Effect.never;
  }).pipe(Effect.scoped);
}
```

- [ ] **Step 3: Create `modules/daemon/dependencies.ts`**

```typescript
// Daemon module infrastructure layers
export { DaemonConfigLayer } from '#modules/daemon/infrastructure/daemon-config';
export { UnixSocketServerLayer } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
```

- [ ] **Step 4: Run typecheck**

```bash
cd packages/app && bun run typecheck 2>&1 | grep "error TS" | head -30
```

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/modules/daemon/
git commit -m "refactor(daemon): extract run-daemon use case, add startup-ops port, create daemon/dependencies.ts"
```

---

## Task 10: Create src/daemon.ts and src/dependencies.ts

**Files:**
- Create: `src/daemon.ts` (replaces `modules/daemon/main.ts` as entry point)
- Create: `src/dependencies.ts` (root composition root)
- Modify: `packages/app/package.json` (update dev script)

This is the most complex task — it wires everything together.

- [ ] **Step 1: Create `src/daemon.ts`**

```typescript
import { join } from 'node:path';
import { homedir } from 'node:os';
import { unlinkSync } from 'node:fs';
import * as BunRuntime from '@effect/platform-bun/BunRuntime';
import { Effect } from 'effect';
import { AppLayer, runDaemon } from './dependencies';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

function cleanup() {
  for (const file of ['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']) {
    try { unlinkSync(join(_HOME, file)); } catch {}
  }
}

process.on('SIGTERM', () => { process.stdout.write('[daemon] Stopped.\n'); cleanup(); process.exit(0); });
process.on('SIGINT', () => { process.stdout.write('[daemon] Stopped.\n'); cleanup(); process.exit(0); });
process.on('uncaughtException', (err) => {
  Effect.runFork(Effect.logError('[daemon] Uncaught exception:', err));
  cleanup();
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  Effect.runFork(Effect.logError('[daemon] Unhandled rejection:', reason));
  cleanup();
  process.exit(1);
});

BunRuntime.runMain(runDaemon.pipe(Effect.provide(AppLayer)));
```

- [ ] **Step 2: Create `src/dependencies.ts`**

This is the composition root. It creates all use cases with correct cross-module wiring (especially `sendToCliClient`):

```typescript
import { join } from 'node:path';
import { homedir } from 'node:os';
import { unlinkSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { makeDatabaseLayer } from '#infra/database';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';

// Agent-session infra layers
import {
  AppEventPublisherTag,
  EventPublisherLayer,
  BunPtySpawnerLayer,
  FsResumabilityCheckerLayer,
  AgentRegistryLayer,
  TerminalSubscribersLayer,
  SqliteSessionRepositoryLayer,
  SqliteTerminalRepositoryLayer,
  createPtyRegistry,
  createSpawnSessionUseCase,
  createSessionLifecycleUseCase,
  createSessionCleanupUseCase,
  createTerminalConnectionUseCase,
  createCheckResumabilityUseCase,
  createSessionQueriesUseCase,
  createSessionRoutes,
  createTerminalRoutes,
} from '#modules/agent-session/dependencies';

// Daemon infra layers
import { DaemonConfigLayer, DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { UnixSocketServerLayer } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';
import { createRunDaemon } from '#modules/daemon/application/use-cases/run-daemon.use-case';

// Agent-session ports
import { EventPublisher } from '#modules/agent-session/application/ports/out/event-publisher.port';
import { PtySpawner } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import { SessionRepository } from '#modules/agent-session/application/ports/out/session-repository.port';
import { TerminalRepository } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import { ResumabilityChecker } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import { AgentRegistry } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import { TerminalSubscribers } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

function cleanup() {
  for (const file of ['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']) {
    try { unlinkSync(join(_HOME, file)); } catch {}
  }
}

const DatabaseLayer = makeDatabaseLayer(`${_HOME}/data.db`);

const BaseInfraLayer = Layer.mergeAll(
  EventPublisherLayer,
  BunPtySpawnerLayer,
  FsResumabilityCheckerLayer,
  AgentRegistryLayer,
  TerminalSubscribersLayer,
  UnixSocketServerLayer,
  DaemonConfigLayer
);

const InfraLayer = Layer.mergeAll(
  SqliteSessionRepositoryLayer,
  SqliteTerminalRepositoryLayer
).pipe(
  Layer.provideMerge(DatabaseLayer),
  Layer.provideMerge(BaseInfraLayer)
);

// The run-daemon effect — takes deps as plain objects wired below
// We create it as an Effect that reads services from context and creates use cases
export const runDaemon = Effect.gen(function* () {
  const sessionRepo = yield* SessionRepository;
  const terminalRepo = yield* TerminalRepository;
  const ptySpawner = yield* PtySpawner;
  const agentRegistry = yield* AgentRegistry;
  const resumabilityChecker = yield* ResumabilityChecker;
  const eventPublisher = yield* EventPublisher;
  const terminalSubs = yield* TerminalSubscribers;
  const ipcServer = yield* IpcServer;
  const appEventPublisher = yield* AppEventPublisherTag;

  const registry = createPtyRegistry();

  // Create TerminalConnectionUseCase first (it provides setupPtyLifecycle to SpawnSession)
  const terminalConnection = createTerminalConnectionUseCase({
    sessionRepo,
    terminalRepo,
    eventPublisher,
    terminalSubs,
    agentRegistry,
    resumabilityChecker,
    registry,
    sendToCliClient: (connId, msg) =>
      Effect.runSync(ipcServer.sendTo(connId, msg)),
  });

  const spawnSession = createSpawnSessionUseCase({
    sessionRepo,
    ptySpawner,
    resumabilityChecker,
    agentRegistry,
    eventPublisher,
    registry,
    setupPtyLifecycle: terminalConnection.setupPtyLifecycle,
  });

  const sessionLifecycle = createSessionLifecycleUseCase({
    sessionRepo,
    resumabilityChecker,
    agentRegistry,
    eventPublisher,
    registry,
  });

  const sessionCleanup = createSessionCleanupUseCase({
    sessionRepo,
    eventPublisher,
  });

  const checkResumability = createCheckResumabilityUseCase({
    sessionRepo,
    resumabilityChecker,
    eventPublisher,
  });

  const sessionQueries = createSessionQueriesUseCase({
    sessionRepo,
    terminalRepo,
  });

  const startupOps = {
    cleanupOrphanedSessions: () => sessionRepo.markOrphanedEnded(),
    pruneOldSessions: () => sessionRepo.pruneOld(),
    checkResumableForAll: () => {
      sessionRepo.findAll().forEach((session) => {
        if (session.agentSessionId) {
          const resumable = resumabilityChecker.isResumable(session.agentSessionId, session.cwd);
          if (resumable !== session.resumable) {
            session.setResumable(resumable);
            sessionRepo.save(session);
            session.pullEvents();
          }
        }
      });
    },
    checkResumableForActive: () => checkResumability.checkResumableForActive(),
  };

  const appRoutes = createRoutesLayer({
    appRoutes: [
      ...createSessionRoutes({
        spawnSession,
        sessionCleanup,
        sessionQueries,
        terminalConnection,
        eventPublisher: appEventPublisher,
      }),
      ...createTerminalRoutes({
        sessionQueries,
        terminalConnection,
        terminalSubs,
      }),
    ],
    clientDistPath: undefined,
  });

  const runner = createRunDaemon({
    startupOps,
    spawnSession,
    sessionLifecycle,
    terminalConnection,
    appRoutes,
    cleanup,
  });

  return yield* runner;
}).pipe(Effect.scoped);

export const AppLayer = InfraLayer;
```

- [ ] **Step 3: Update `packages/app/package.json` dev script**

```json
"dev": "bun run build:client && VIGIE_DEV=true bun run --watch src/daemon.ts",
```

- [ ] **Step 4: Run typecheck**

```bash
cd packages/app && bun run typecheck 2>&1 | grep "error TS" | head -40
```

Expected: Many errors because old `modules/daemon/main.ts` still exists and the old session/terminal modules haven't been deleted. The new files should mostly typecheck.

- [ ] **Step 5: Test that daemon can start**

```bash
cd packages/app && bun run src/daemon.ts &
sleep 2
curl http://localhost:19191/api/health
kill %1
```

Expected: `{"status":"ok","pid":...}` — daemon starts successfully.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/daemon.ts packages/app/src/dependencies.ts packages/app/package.json
git commit -m "refactor(daemon): create src/daemon.ts entry point and src/dependencies.ts composition root"
```

---

## Task 11: Clean up — delete old modules and shared/kernel files

**Files deleted in this task:**
- `modules/daemon/main.ts`
- `modules/session/` (entire directory)
- `modules/terminal/` (entire directory)
- `shared/kernel/session-id.ts`
- `shared/kernel/domain-events.ts`
- `shared/kernel/terminal-gateway.ts`
- `shared/kernel/pty.ts`

**Files updated to remove old imports:**
- Any remaining imports of `#shared/kernel/session-id` → update to `#modules/agent-session/domain/session-id`
- Any remaining imports of `#shared/kernel/domain-events` → update to `#modules/agent-session/domain/events`
- Any remaining imports of `#modules/session/...` or `#modules/terminal/...` → update to `#modules/agent-session/...`

- [ ] **Step 1: Delete old session and terminal modules**

```bash
rm -rf packages/app/src/modules/session
rm -rf packages/app/src/modules/terminal
```

- [ ] **Step 2: Delete old daemon main.ts**

```bash
rm packages/app/src/modules/daemon/main.ts
```

- [ ] **Step 3: Delete moved shared/kernel files**

```bash
rm packages/app/src/shared/kernel/session-id.ts
rm packages/app/src/shared/kernel/domain-events.ts
rm packages/app/src/shared/kernel/terminal-gateway.ts
rm packages/app/src/shared/kernel/pty.ts
```

- [ ] **Step 4: Run typecheck to find remaining broken imports**

```bash
cd packages/app && bun run typecheck 2>&1 | grep "error TS" | head -50
```

Find all files with broken imports and fix them. Common patterns to fix:
- `#shared/kernel/session-id` → `#modules/agent-session/domain/session-id`
- `#shared/kernel/domain-events` → `#modules/agent-session/domain/events`
- `#shared/kernel/pty` → `#modules/agent-session/application/ports/out/pty-spawner.port`
- Any `#modules/session/...` → `#modules/agent-session/...`
- Any `#modules/terminal/...` → `#modules/agent-session/...`

Fix each file until typecheck passes.

- [ ] **Step 5: Run tests**

```bash
cd packages/app && bun test
```

Expected: All tests pass. Tests that referenced old paths now use agent-session paths. Domain tests should pass unchanged (logic didn't change, only paths).

The old `session-service.unit.test.ts` is deleted (it tested `createSessionService` which no longer exists). New use-case tests would need to be written — but this is a pure structural refactor, so we skip new test files if the existing integration tests cover the behavior.

- [ ] **Step 6: Run full verify**

```bash
cd packages/app && bun run verify
```

Expected: All checks pass (knip, biome, typecheck, test, build).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: delete old session + terminal modules and cleaned shared/kernel"
```

---

## Task 12: Update dependency-cruiser config and add CLAUDE.md files

**Files:**
- Modify: `packages/app/.dependency-cruiser.cjs`
- Create: `packages/app/src/modules/CLAUDE.md`
- Create: `packages/app/src/modules/daemon/CLAUDE.md`
- Create: `packages/app/src/modules/agent-session/CLAUDE.md`

- [ ] **Step 1: Update `.dependency-cruiser.cjs` with generic 3-rule approach**

Replace the entire `forbidden` array with three generic rules:

```javascript
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Rule 1: No cross-module imports (generic — works for any module names)
    {
      name: 'no-cross-module-imports',
      comment:
        'Modules must not import from each other. Only dependencies.ts files may cross module boundaries.',
      severity: 'error',
      from: {
        path: '^src/modules/([^/]+)/',
        pathNot: [
          // Composition roots are allowed to cross boundaries
          '^src/modules/[^/]+/dependencies\\.ts$',
          // UI islands may compose across modules
          'src/modules/[^/]+/infrastructure/adapters/in/ui/.*',
        ],
      },
      to: {
        path: '^src/modules/([^/]+)/',
        // Forbidden when the to-module is different from the from-module
        // dependency-cruiser uses backreferences: $1 is the from-module name
        pathNot: '^src/modules/$1/',
      },
    },

    // Rule 2: Shared kernel is one-way (kernel cannot import from modules)
    {
      name: 'no-shared-kernel-imports-modules',
      comment: 'Shared kernel must not import from any module.',
      severity: 'error',
      from: {
        path: '^src/shared/',
      },
      to: {
        path: '^src/modules/',
      },
    },

    // Rule 3: Only composition roots may cross module boundaries
    // (Enforced by Rule 1 exceptions above)
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
```

- [ ] **Step 2: Run dependency check**

```bash
cd packages/app && bun run check-boundaries
```

Expected: No violations. If violations exist, fix the offending imports.

- [ ] **Step 3: Create `src/modules/CLAUDE.md`**

```markdown
# Module Boundary Rules

- No cross-module imports. `modules/X` must not import from `modules/Y`.
- Only `modules/*/dependencies.ts` may wire across module boundaries.
- Only UI islands (`modules/*/infrastructure/adapters/in/ui/`) may compose across modules.
- Shared kernel (`#shared/kernel/`) is for cross-cutting wire protocols owned by no single bounded context.
  - If something moves to shared/kernel to escape an import error, that is a boundary smell — fix the module design instead.
- Each module owns its `CLAUDE.md`, `dependencies.ts`, and domain layer.
- `src/dependencies.ts` (root) is the only file allowed to import from multiple modules simultaneously.
```

- [ ] **Step 4: Create `src/modules/daemon/CLAUDE.md`**

```markdown
# daemon module

## Owns
- Daemon lifecycle (startup, shutdown, signal handling)
- HTTP + WebSocket server (routes, server config)
- IPC server (Unix socket server, IPC router)
- CLI command handling (vigie daemon, vigie open, vigie session)
- Daemon config (port, socket path, vigie home)
- Process manager (spawn/kill daemon process)

## Does not own
- Session state or PTY handles
- Terminal chunks or input history
- Agent adapters or agent logic

## Key conventions
- Session IDs are opaque `string` here — branding is agent-session's concern.
- Never import from `#modules/agent-session/`. Use ports in `application/ports/in/`.
- `daemon/dependencies.ts` only exports daemon-specific infrastructure layers.
```

- [ ] **Step 5: Create `src/modules/agent-session/CLAUDE.md`**

```markdown
# agent-session module

## Owns
- Session lifecycle (register, spawn, resume, end, delete)
- PTY management (spawn, resize, kill, output)
- Terminal chunks (append, query)
- Input buffering and history
- Agent adapters (`AgentAdapter` port + `AgentRegistry`)
- Resumability checking
- Domain events (published via `EventPublisher` port)
- `SessionId` branded type

## Does not own
- HTTP serving or WebSocket broadcasting
- IPC protocol details
- Daemon config

## Key conventions
- `SessionId` branded type lives here. Use `SessionId as makeSessionId` for construction.
- Events published via `EventPublisher` port. Daemon adapts events to browser format at root `src/dependencies.ts`.
- `agent-session/dependencies.ts` exports infrastructure layers and use case factories.
- Use cases are plain factory functions sharing a `PtyRegistry` internal state module.
- Never import from `#modules/daemon/`. If daemon-level behavior is needed, use a callback dep.
```

- [ ] **Step 6: Run full verify**

```bash
cd /path/to/vigie && bun run verify
```

Expected: All pipeline steps pass (knip → biome → typecheck → test → build).

- [ ] **Step 7: Commit**

```bash
git add packages/app/.dependency-cruiser.cjs packages/app/src/modules/CLAUDE.md packages/app/src/modules/daemon/CLAUDE.md packages/app/src/modules/agent-session/CLAUDE.md
git commit -m "refactor: update dependency-cruiser with generic rules and add module CLAUDE.md boundary docs"
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Task covering it | Status |
|---|---|---|
| Merge session + terminal into agent-session | Tasks 1–5 | ✓ |
| Split session.service.ts into 6 use cases | Task 4 | ✓ |
| src/daemon.ts thin entry point | Task 10 | ✓ |
| src/dependencies.ts composition root | Task 10 | ✓ |
| modules/daemon/dependencies.ts | Task 9 | ✓ |
| modules/agent-session/dependencies.ts | Task 8 | ✓ |
| SessionId moves to agent-session/domain | Task 1 | ✓ |
| DomainEvents moves to agent-session/domain | Task 1 | ✓ |
| AgentRunnerError stays in shared/kernel | Decision logged in File Map | ✓ |
| terminal-gateway.ts deleted | Task 5 (skip moving it) | ✓ |
| DaemonNotRunningError/IpcConnectionError owned by daemon/domain | Task 1 + Task 6 | ✓ |
| IPC router uses split use case shapes | Task 7 | ✓ |
| HTTP routes use split use case shapes | Task 7 | ✓ |
| Generic dependency-cruiser rules | Task 12 | ✓ |
| CLAUDE.md files | Task 12 | ✓ |
| shared/kernel only keeps ipc-protocol.ts | Task 11 | ✓ |

### Placeholder scan

- `session.routes.tsx` in Task 7 has `killedCount: -1` — this is a deliberate simplification (kill-all doesn't track count in new design). Document if needed.
- `createRunDaemon` in Task 9 has `Bun.file(config.socketPath)` where old code used `unlinkSync` — **BUG**, fix to `unlinkSync`.
- `run-daemon.use-case.ts` imports path resolution uses `..`, `..`, `..` — verify relative path is correct based on final file location.

### Type consistency

- `SpawnSessionShape.spawnInteractive` returns `Effect<{ sessionId: string; pid: number }, Error>` — matches `SpawnSessionDeps` return in Task 4 ✓
- `TerminalConnectionShape.addBrowserChannel` returns `number | null` (the pid) — matches terminal-connection use case ✓
- `SessionQueriesShape.findById` returns `SessionInfo | null` in daemon port (Task 6), but agent-session's `SessionQueriesUseCase` returns `Session | null` (Task 4) — **mismatch!** The routes in Task 7 import directly from agent-session use cases (not daemon ports), so they get `Session` back. The `sessionToDTO` mapper in `session.routes.tsx` handles the mapping. The `SessionQueriesShape` daemon port with `SessionInfo` is only needed if daemon code calls it (the IPC router doesn't query sessions). Remove `SessionQueriesShape` port from `modules/daemon/application/ports/in/` if it's unused — or don't create it.

**Fix:** In Task 6, do not create `session-queries.port.ts` for daemon. The routes are in agent-session and import use cases directly. The daemon's `run-daemon.use-case.ts` doesn't query sessions. Remove that file from Task 6 scope.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-08-hexagonal-refacto.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
