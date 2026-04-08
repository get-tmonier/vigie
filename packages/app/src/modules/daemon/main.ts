import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Duration, Effect, Fiber, Layer, Schedule } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { makeDatabaseLayer, VigiDatabase } from '#infra/database';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createIpcRouter } from '#modules/daemon/infrastructure/adapters/in/ipc-router';
import { UnixSocketServerLayer } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
import { DaemonConfig, DaemonConfigLayer } from '#modules/daemon/infrastructure/daemon-config';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';
import { ResumabilityChecker } from '#modules/session/application/ports/out/resumability-checker.port';
import { SessionRepository } from '#modules/session/application/ports/out/session-repository.port';
import {
  SessionServiceLayer,
  SessionServiceTag,
} from '#modules/session/application/session.service';
import { createSessionRoutes } from '#modules/session/infrastructure/adapters/in/session.routes';
import { AgentRegistryLayer } from '#modules/session/infrastructure/adapters/out/agents/agent-registry';
import { FsResumabilityCheckerLayer } from '#modules/session/infrastructure/adapters/out/fs-resumability-checker';
import { SqliteSessionRepositoryLayer } from '#modules/session/infrastructure/adapters/out/sqlite-session-repository';
import { EventPublisher } from '#modules/terminal/application/ports/out/event-publisher.port';
import { PtySpawner } from '#modules/terminal/application/ports/out/pty-spawner.port';
import { TerminalRepository } from '#modules/terminal/application/ports/out/terminal-repository.port';
import {
  TerminalSubscribers,
  TerminalSubscribersLayer,
} from '#modules/terminal/application/terminal-subscribers';
import { createTerminalRoutes } from '#modules/terminal/infrastructure/adapters/in/terminal.routes';
import { BunPtySpawnerLayer } from '#modules/terminal/infrastructure/adapters/out/bun-pty-spawner';
import {
  AppEventPublisherTag,
  EventPublisherLayer,
} from '#modules/terminal/infrastructure/adapters/out/event-publisher.adapter';
import { SqliteTerminalRepositoryLayer } from '#modules/terminal/infrastructure/adapters/out/sqlite-terminal-repository';
import { createTerminalGateway } from '#modules/terminal/infrastructure/adapters/out/terminal-gateway.adapter';
import { TerminalGateway } from '#shared/kernel/terminal-gateway';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');
const _PID_FILE = join(_HOME, 'daemon.pid');
const _SOCKET_PATH = join(_HOME, 'daemon.sock');
const _STDIN_SOCKET_PATH = join(_HOME, 'daemon-stdin.sock');
const _PORT_FILE = join(_HOME, 'port');

function cleanup() {
  try {
    unlinkSync(_PID_FILE);
  } catch {}
  try {
    unlinkSync(_SOCKET_PATH);
  } catch {}
  try {
    unlinkSync(_STDIN_SOCKET_PATH);
  } catch {}
  try {
    unlinkSync(_PORT_FILE);
  } catch {}
}

export const runDaemon = Effect.gen(function* () {
  const config = yield* DaemonConfig;

  mkdirSync(config.vigieHome, { recursive: true, mode: 0o700 });
  writeFileSync(config.pidFile, `${process.pid}\n${Date.now()}`);
  yield* Effect.logInfo(`[daemon] Started (pid ${process.pid})`);

  // ── 1. Get services from context ───────────────────────────────────
  const db = yield* VigiDatabase;
  const sessionService = yield* SessionServiceTag;
  const ipcServer = yield* IpcServer;
  const eventPublisher = yield* AppEventPublisherTag;
  const terminalSubs = yield* TerminalSubscribers;
  const sessionRepo = yield* SessionRepository;
  const resumabilityChecker = yield* ResumabilityChecker;

  // ── 2. Startup tasks ──────────────────────────────────────────────
  sessionRepo.markOrphanedEnded();
  sessionRepo.pruneOld();

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

  yield* Effect.logInfo('[daemon] SQLite database opened, orphaned sessions cleaned up');

  const pruneFiber = yield* Effect.forkDetach(
    Effect.repeat(
      Effect.gen(function* () {
        sessionRepo.pruneOld();
        yield* Effect.logInfo('[daemon] Pruned old sessions');
      }),
      Schedule.spaced(Duration.hours(1))
    )
  );

  const resumableFiber = yield* Effect.forkDetach(
    Effect.repeat(
      Effect.sync(() => sessionService.checkResumableForActive()),
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

  // ── 3. HTTP + WebSocket server ─────────────────────────────────────
  const clientDistCandidates = [
    join(dirname(process.execPath), 'client'),
    resolve(import.meta.dir, '..', '..', '..', 'dist', 'client'),
  ];
  const clientDistPath = clientDistCandidates.find((p) => existsSync(p));
  if (clientDistPath) {
    yield* Effect.logInfo(`[daemon] Serving client islands from ${clientDistPath}`);
  }

  const appRoutes = [
    ...createSessionRoutes({ sessionService, eventPublisher }),
    ...createTerminalRoutes({ sessionService, terminalSubs }),
  ];

  const routesLayer = createRoutesLayer({ appRoutes, clientDistPath });

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

  // ── 4. IPC Server ─────────────────────────────────────────────────
  if (existsSync(config.socketPath)) unlinkSync(config.socketPath);
  if (existsSync(config.stdinSocketPath)) unlinkSync(config.stdinSocketPath);

  const router = createIpcRouter({
    spawnSession: sessionService,
    sessionLifecycle: sessionService,
    terminalConnection: {
      ...sessionService,
      killAll: () => {},
      addBrowserChannel: () => null,
      updateBrowserChannel: () => {},
      removeBrowserChannel: () => {},
      writeBinaryInput: () => {},
    },
  });
  yield* ipcServer.start(config.socketPath, router, (connId) =>
    Effect.sync(() => sessionService.handleDisconnect(connId))
  );

  yield* Effect.logInfo(`[daemon] IPC server listening on ${config.socketPath}`);

  // ── 5. Stdin socket ───────────────────────────────────────────────
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
            sessionService.writeInput(parsed.sessionId, parsed.data, 'cli');
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

// ── Composition root ──────────────────────────────────────────────────

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

const InfraLayer = Layer.mergeAll(SqliteSessionRepositoryLayer, SqliteTerminalRepositoryLayer).pipe(
  Layer.provideMerge(DatabaseLayer),
  Layer.provideMerge(BaseInfraLayer)
);

const TerminalGatewayLayer = Layer.effect(TerminalGateway)(
  Effect.gen(function* () {
    const ptySpawner = yield* PtySpawner;
    const terminalRepo = yield* TerminalRepository;
    const eventPublisher = yield* EventPublisher;
    const terminalSubs = yield* TerminalSubscribers;
    const ipcServer = yield* IpcServer;
    const gatewayServices = yield* Effect.services<never>();
    return createTerminalGateway({
      ptySpawner,
      terminalRepo,
      eventPublisher,
      terminalSubs,
      sendToCliClient: (connId, msg) =>
        Effect.runSyncWith(gatewayServices)(ipcServer.sendTo(connId, msg)),
    });
  })
);

const TerminalGatewayWithDeps = TerminalGatewayLayer.pipe(Layer.provide(InfraLayer));

export const AppLayer = SessionServiceLayer.pipe(
  Layer.provideMerge(TerminalGatewayWithDeps),
  Layer.provideMerge(InfraLayer)
);

if (import.meta.main) {
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

  Effect.runFork(runDaemon.pipe(Effect.provide(AppLayer)));
}
