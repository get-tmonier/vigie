# Module Self-Contained Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each module's `dependencies.ts` self-contained (infra + use cases + routes), so `src/dependencies.ts` only imports module layers and provides cross-cutting infra (`DatabaseLive`).

**Architecture:** Add a `CliSender` out-port to `agent-session` so daemon can satisfy it without violating module boundaries. Each module exports one composed `*Live` layer. `src/dependencies.ts` becomes a 3-line merger. All layer implementations are renamed from `*Layer` to `*Live` to follow Effect conventions.

**Tech Stack:** Effect (Layer, Context.Tag), TypeScript strict, Bun

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `src/modules/agent-session/infrastructure/adapters/out/agents/agent-registry.ts` | Rename `AgentRegistryLayer` → `AgentRegistryLive` |
| Modify | `src/modules/agent-session/infrastructure/adapters/out/bun-pty-spawner.ts` | Rename `BunPtySpawnerLayer` → `BunPtySpawnerLive` |
| Modify | `src/modules/agent-session/infrastructure/adapters/out/event-publisher.adapter.ts` | Rename `EventPublisherLayer` → `EventPublisherLive` |
| Modify | `src/modules/agent-session/infrastructure/adapters/out/fs-resumability-checker.ts` | Rename `FsResumabilityCheckerLayer` → `FsResumabilityCheckerLive` |
| Modify | `src/modules/agent-session/infrastructure/adapters/out/sqlite-session-repository.ts` | Rename `SqliteSessionRepositoryLayer` → `SqliteSessionRepositoryLive` |
| Modify | `src/modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository.ts` | Rename `SqliteTerminalRepositoryLayer` → `SqliteTerminalRepositoryLive` |
| Modify | `src/modules/agent-session/infrastructure/adapters/out/terminal-subscribers.ts` | Rename `TerminalSubscribersLayer` → `TerminalSubscribersLive` |
| Modify | `src/modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter.ts` | Rename `UnixSocketServerLayer` → `UnixSocketServerLive` |
| Modify | `src/modules/daemon/infrastructure/daemon-config.ts` | Rename `DaemonConfigLayer` → `DaemonConfigLive` |
| Create | `src/modules/agent-session/application/ports/out/cli-sender.port.ts` | `CliSender` tag — new out-port |
| Rewrite | `src/modules/agent-session/dependencies.ts` | `AgentSession` tag + `AgentSessionLive` layer |
| Rewrite | `src/modules/daemon/dependencies.ts` | `DaemonLive` layer + `runDaemon` effect + `cleanup` |
| Rewrite | `src/dependencies.ts` | Thin merger: `AppLive` + re-export `runDaemon` |
| Modify | `src/daemon.ts` | Import `cleanup` from daemon/dependencies |

All paths below are relative to `packages/app/`.

---

## Task 1: Rename `*Layer` → `*Live` in all adapter files

These are purely mechanical renames. All 9 files follow the same pattern: rename the exported `const` and update the export.

**Files:**
- Modify: `src/modules/agent-session/infrastructure/adapters/out/agents/agent-registry.ts`
- Modify: `src/modules/agent-session/infrastructure/adapters/out/bun-pty-spawner.ts`
- Modify: `src/modules/agent-session/infrastructure/adapters/out/event-publisher.adapter.ts`
- Modify: `src/modules/agent-session/infrastructure/adapters/out/fs-resumability-checker.ts`
- Modify: `src/modules/agent-session/infrastructure/adapters/out/sqlite-session-repository.ts`
- Modify: `src/modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository.ts`
- Modify: `src/modules/agent-session/infrastructure/adapters/out/terminal-subscribers.ts`
- Modify: `src/modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter.ts`
- Modify: `src/modules/daemon/infrastructure/daemon-config.ts`

- [ ] **Step 1: Rename in agent-registry.ts**

In `src/modules/agent-session/infrastructure/adapters/out/agents/agent-registry.ts`, change:
```typescript
export const AgentRegistryLayer = Layer.sync(AgentRegistry)(() => createAgentRegistry());
```
to:
```typescript
export const AgentRegistryLive = Layer.sync(AgentRegistry)(() => createAgentRegistry());
```

- [ ] **Step 2: Rename in bun-pty-spawner.ts**

In `src/modules/agent-session/infrastructure/adapters/out/bun-pty-spawner.ts`, change:
```typescript
export const BunPtySpawnerLayer = Layer.sync(PtySpawner)(() => createBunPtySpawner());
```
to:
```typescript
export const BunPtySpawnerLive = Layer.sync(PtySpawner)(() => createBunPtySpawner());
```

- [ ] **Step 3: Rename in event-publisher.adapter.ts**

In `src/modules/agent-session/infrastructure/adapters/out/event-publisher.adapter.ts`, change:
```typescript
export const EventPublisherLayer = Layer.effect(EventPublisher)(
  Effect.service(AppEventPublisherTag)
).pipe(Layer.provideMerge(Layer.sync(AppEventPublisherTag)(() => createEventPublisher())));
```
to:
```typescript
export const EventPublisherLive = Layer.effect(EventPublisher)(
  Effect.service(AppEventPublisherTag)
).pipe(Layer.provideMerge(Layer.sync(AppEventPublisherTag)(() => createEventPublisher())));
```

- [ ] **Step 4: Rename in fs-resumability-checker.ts**

In `src/modules/agent-session/infrastructure/adapters/out/fs-resumability-checker.ts`, change:
```typescript
export const FsResumabilityCheckerLayer = Layer.sync(ResumabilityChecker)(() =>
```
to:
```typescript
export const FsResumabilityCheckerLive = Layer.sync(ResumabilityChecker)(() =>
```

- [ ] **Step 5: Rename in sqlite-session-repository.ts**

In `src/modules/agent-session/infrastructure/adapters/out/sqlite-session-repository.ts`, change:
```typescript
export const SqliteSessionRepositoryLayer = Layer.effect(SessionRepository)(
```
to:
```typescript
export const SqliteSessionRepositoryLive = Layer.effect(SessionRepository)(
```

- [ ] **Step 6: Rename in sqlite-terminal-repository.ts**

In `src/modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository.ts`, change:
```typescript
export const SqliteTerminalRepositoryLayer = Layer.effect(TerminalRepository)(
```
to:
```typescript
export const SqliteTerminalRepositoryLive = Layer.effect(TerminalRepository)(
```

- [ ] **Step 7: Rename in terminal-subscribers.ts**

In `src/modules/agent-session/infrastructure/adapters/out/terminal-subscribers.ts`, change:
```typescript
export const TerminalSubscribersLayer = Layer.sync(TerminalSubscribers)(() =>
```
to:
```typescript
export const TerminalSubscribersLive = Layer.sync(TerminalSubscribers)(() =>
```

- [ ] **Step 8: Rename in unix-socket-server.adapter.ts**

In `src/modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter.ts`, change:
```typescript
export const UnixSocketServerLayer = Layer.sync(IpcServer)(() => createUnixSocketServer());
```
to:
```typescript
export const UnixSocketServerLive = Layer.sync(IpcServer)(() => createUnixSocketServer());
```

- [ ] **Step 9: Rename in daemon-config.ts**

In `src/modules/daemon/infrastructure/daemon-config.ts`, change:
```typescript
export const DaemonConfigLayer = Layer.sync(DaemonConfig)(() => {
```
to:
```typescript
export const DaemonConfigLive = Layer.sync(DaemonConfig)(() => {
```

- [ ] **Step 10: Typecheck**

```bash
cd packages/app && bun run typecheck
```
Expected: errors about the old names (`AgentRegistryLayer`, etc.) being used in `agent-session/dependencies.ts` and `daemon/dependencies.ts`. That's expected — those files will be rewritten in later tasks. If errors appear in OTHER files, fix them now.

- [ ] **Step 11: Commit**

```bash
git add packages/app/src/modules
git commit -m "refactor(app): rename *Layer to *Live in all adapter implementations"
```

---

## Task 2: Add `CliSender` out-port to agent-session

`createTerminalConnectionUseCase` currently takes a raw `sendToCliClient` callback. We need to express this as a port so daemon can provide it as a layer.

**Files:**
- Create: `src/modules/agent-session/application/ports/out/cli-sender.port.ts`

- [ ] **Step 1: Create the port file**

Create `src/modules/agent-session/application/ports/out/cli-sender.port.ts`:

```typescript
import { Context } from 'effect';

export interface CliSenderShape {
  send: (connId: string, msg: string) => void;
}

export class CliSender extends Context.Tag('CliSender')<CliSender, CliSenderShape>() {}
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/app && bun run typecheck
```
Expected: same errors as before (no new errors introduced by this file).

---

## Task 3: Rewrite `agent-session/dependencies.ts`

This is the core of the refactoring. We add an `AgentSession` Context tag that holds all built use cases and routes, then build `AgentSessionLive` which wires everything using Effect.gen.

**Files:**
- Modify: `src/modules/agent-session/dependencies.ts`

- [ ] **Step 1: Write the new dependencies.ts**

Replace the entire content of `src/modules/agent-session/dependencies.ts`:

```typescript
import { Context, Effect, Layer } from 'effect';
import type * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { CliSender } from '#modules/agent-session/application/ports/out/cli-sender.port';
import { AgentRegistry } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import { EventPublisher } from '#modules/agent-session/application/ports/out/event-publisher.port';
import { PtySpawner } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import { ResumabilityChecker } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import { SessionRepository } from '#modules/agent-session/application/ports/out/session-repository.port';
import { TerminalRepository } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import { createTerminalConnectionUseCase } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { createSessionRoutes } from '#modules/agent-session/infrastructure/adapters/in/session.routes';
import { createTerminalRoutes } from '#modules/agent-session/infrastructure/adapters/in/terminal.routes';
import { AgentRegistryLive } from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
import { BunPtySpawnerLive } from '#modules/agent-session/infrastructure/adapters/out/bun-pty-spawner';
import {
  AppEventPublisherTag,
  EventPublisherLive,
} from '#modules/agent-session/infrastructure/adapters/out/event-publisher.adapter';
import { FsResumabilityCheckerLive } from '#modules/agent-session/infrastructure/adapters/out/fs-resumability-checker';
import { SqliteSessionRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
import { SqliteTerminalRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
import {
  TerminalSubscribers,
  TerminalSubscribersLive,
} from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import { createPtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';

// ── Types ────────────────────────────────────────────────────────────────────

type AgentSessionServices = {
  spawnSession: ReturnType<typeof createSpawnSessionUseCase>;
  sessionLifecycle: ReturnType<typeof createSessionLifecycleUseCase>;
  sessionCleanup: ReturnType<typeof createSessionCleanupUseCase>;
  checkResumability: ReturnType<typeof createCheckResumabilityUseCase>;
  sessionQueries: ReturnType<typeof createSessionQueriesUseCase>;
  terminalConnection: ReturnType<typeof createTerminalConnectionUseCase>;
  startupOps: {
    cleanupOrphanedSessions(): void;
    pruneOldSessions(): void;
    checkResumableForAll(): void;
    checkResumableForActive(): void;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routes: HttpRouter.Route<any, any>[];
};

export class AgentSession extends Context.Tag('AgentSession')<AgentSession, AgentSessionServices>() {}

// ── Infra layer ───────────────────────────────────────────────────────────────

const AgentSessionInfraLive = Layer.mergeAll(
  EventPublisherLive,
  BunPtySpawnerLive,
  FsResumabilityCheckerLive,
  AgentRegistryLive,
  TerminalSubscribersLive,
  SqliteSessionRepositoryLive,
  SqliteTerminalRepositoryLive,
);

// ── Use cases + routes layer ──────────────────────────────────────────────────

export const AgentSessionLive = Layer.effect(AgentSession)(
  Effect.gen(function* () {
    const sessionRepo = yield* SessionRepository;
    const terminalRepo = yield* TerminalRepository;
    const ptySpawner = yield* PtySpawner;
    const agentRegistry = yield* AgentRegistry;
    const resumabilityChecker = yield* ResumabilityChecker;
    const eventPublisher = yield* EventPublisher;
    const terminalSubs = yield* TerminalSubscribers;
    const appEventPublisher = yield* AppEventPublisherTag;
    const cliSender = yield* CliSender;

    const registry = createPtyRegistry();

    const terminalConnection = createTerminalConnectionUseCase({
      sessionRepo,
      terminalRepo,
      eventPublisher,
      terminalSubs,
      agentRegistry,
      resumabilityChecker,
      registry,
      sendToCliClient: (connId, msg) => cliSender.send(connId, msg),
    });

    const spawnSession = createSpawnSessionUseCase({
      sessionRepo,
      ptySpawner,
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

    const routes = [
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
    ];

    return {
      spawnSession,
      sessionLifecycle,
      sessionCleanup,
      checkResumability,
      sessionQueries,
      terminalConnection,
      startupOps,
      routes,
    };
  })
).pipe(Layer.provide(AgentSessionInfraLive));
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/app && bun run typecheck
```
Expected: errors about `CliSender` not yet being provided by a layer (it's a requirement of `AgentSessionLive`). That's expected — daemon provides it in Task 5. Any other errors: fix them now.

---

## Task 4: Rewrite `daemon/dependencies.ts`

Daemon provides `DaemonLive` (its own infra + `CliSenderLive`), exports `cleanup`, and exports `runDaemon` (the main daemon effect). `daemon/dependencies.ts` is allowed to import from `agent-session` (per module boundary rules).

**Files:**
- Modify: `src/modules/daemon/dependencies.ts`

- [ ] **Step 1: Write the new daemon/dependencies.ts**

Replace the entire content of `src/modules/daemon/dependencies.ts`:

```typescript
import { unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer } from 'effect';
import { AgentSession } from '#modules/agent-session/dependencies';
import { CliSender } from '#modules/agent-session/application/ports/out/cli-sender.port';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createRunDaemon } from '#modules/daemon/application/use-cases/run-daemon.use-case';
import { DaemonConfigLive } from '#modules/daemon/infrastructure/daemon-config';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';
import { UnixSocketServerLive } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

export function cleanup(): void {
  for (const file of ['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']) {
    try {
      unlinkSync(join(_HOME, file));
    } catch {}
  }
}

const CliSenderLive = Layer.effect(CliSender)(
  Effect.gen(function* () {
    const ipcServer = yield* IpcServer;
    return {
      send: (connId: string, msg: string): void => {
        Effect.runFork(ipcServer.sendTo(connId, msg));
      },
    };
  })
);

export const DaemonLive = Layer.mergeAll(UnixSocketServerLive, DaemonConfigLive, CliSenderLive);

export const runDaemon = Effect.gen(function* () {
  const agentSession = yield* AgentSession;
  const appRoutes = createRoutesLayer({ appRoutes: agentSession.routes });
  const runner = createRunDaemon({
    startupOps: agentSession.startupOps,
    spawnSession: agentSession.spawnSession,
    sessionLifecycle: agentSession.sessionLifecycle,
    terminalConnection: agentSession.terminalConnection,
    appRoutes,
    cleanup,
  });
  yield* runner;
});
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/app && bun run typecheck
```
Expected: errors about the old names in `src/dependencies.ts`. No new structural errors. Fix any unexpected type errors that appear.

- [ ] **Step 3: Check boundaries**

```bash
cd packages/app && bun run check-boundaries
```
Expected: no violations — `daemon/dependencies.ts` is explicitly excluded from the cross-module import rule.

---

## Task 5: Rewrite `src/dependencies.ts`

This file becomes a thin merger. It only knows about module layers and provides `DatabaseLive`.

**Files:**
- Modify: `src/dependencies.ts`

- [ ] **Step 1: Write the new src/dependencies.ts**

Replace the entire content of `src/dependencies.ts`:

```typescript
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Layer } from 'effect';
import { makeDatabaseLayer } from '#infra/database';
import { AgentSessionLive } from '#modules/agent-session/dependencies';
import { DaemonLive, runDaemon } from '#modules/daemon/dependencies';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

const DatabaseLive = makeDatabaseLayer(`${_HOME}/data.db`);

export const AppLive = AgentSessionLive.pipe(
  Layer.provide(DaemonLive),
  Layer.provide(DatabaseLive),
);

export { runDaemon };
```

- [ ] **Step 2: Typecheck**

```bash
cd packages/app && bun run typecheck
```
Expected: clean (or errors only in `daemon.ts` if it still imports old names — fixed in Task 7).

---

## Task 6: Update `daemon.ts`

`daemon.ts` currently defines its own `cleanup` and `_HOME`. Now it imports `cleanup` from daemon's dependencies. It also needs to import `AppLive` instead of the old `AppLayer`.

**Files:**
- Modify: `src/daemon.ts`

- [ ] **Step 1: Read the current daemon.ts**

Current content of `src/daemon.ts`:
```typescript
import { unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as BunRuntime from '@effect/platform-bun/BunRuntime';
import { Effect } from 'effect';
import { AppLayer, runDaemon } from './dependencies';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

function cleanup() {
  for (const file of ['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']) {
    try {
      unlinkSync(join(_HOME, file));
    } catch {}
  }
}

process.on('SIGTERM', () => { ... cleanup(); ... });
process.on('SIGINT', () => { ... cleanup(); ... });
process.on('uncaughtException', (err) => { ... cleanup(); ... });
process.on('unhandledRejection', (reason) => { ... cleanup(); ... });

BunRuntime.runMain(runDaemon.pipe(Effect.provide(AppLayer)));
```

- [ ] **Step 2: Write the updated daemon.ts**

Replace the entire content of `src/daemon.ts`:

```typescript
import * as BunRuntime from '@effect/platform-bun/BunRuntime';
import { Effect } from 'effect';
import { AppLive, runDaemon } from './dependencies';
import { cleanup } from '#modules/daemon/dependencies';

process.on('SIGTERM', () => {
  process.stdout.write('[daemon] Stopped.\n');
  cleanup();
  process.exit(0);
});
process.on('SIGINT', () => {
  process.stdout.write('[daemon] Stopped.\n');
  cleanup();
  process.exit(0);
});
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

BunRuntime.runMain(runDaemon.pipe(Effect.provide(AppLive)));
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/app && bun run typecheck
```
Expected: clean.

---

## Task 7: Full verification and commit

- [ ] **Step 1: Run full verify pipeline**

```bash
bun run verify
```
Expected: all steps pass — `knip → biome check → check-imports → check-boundaries → check-cycles → typecheck → test → build`.

- [ ] **Step 2: Fix any remaining issues**

If `biome` flags unused imports or formatting issues, run:
```bash
bun turbo check:fix --filter=@vigie/app
```

If `knip` flags unused exports (e.g., the old `AgentRegistryLayer` name is still somewhere), find and fix the stale reference.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src
git commit -m "refactor(app): make module dependencies self-contained with Live suffix"
```
