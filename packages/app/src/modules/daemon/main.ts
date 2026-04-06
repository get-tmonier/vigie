import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Effect, Layer } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { makeDatabaseLayer, VigiDatabase } from '#infra/database';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createIpcRouter } from '#modules/daemon/infrastructure/adapters/in/ipc-router';
import { UnixSocketServerLayer } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';
import { ResumabilityChecker } from '#modules/session/application/ports/out/resumability-checker.port';
import { SessionRepository } from '#modules/session/application/ports/out/session-repository.port';
import {
  SessionServiceLayer,
  SessionServiceTag,
} from '#modules/session/application/session.service';
import { AgentRegistryLayer } from '#modules/session/infrastructure/adapters/out/agents/agent-registry';
import { FsResumabilityCheckerLayer } from '#modules/session/infrastructure/adapters/out/fs-resumability-checker';
import { SqliteSessionRepositoryLayer } from '#modules/session/infrastructure/adapters/out/sqlite-session-repository';
import {
  TerminalSubscribers,
  TerminalSubscribersLayer,
} from '#modules/terminal/application/terminal-subscribers';
import { BunPtySpawnerLayer } from '#modules/terminal/infrastructure/adapters/out/bun-pty-spawner';
import {
  AppEventPublisherTag,
  EventPublisherLayer,
} from '#modules/terminal/infrastructure/adapters/out/event-publisher.adapter';
import { SqliteTerminalRepositoryLayer } from '#modules/terminal/infrastructure/adapters/out/sqlite-terminal-repository';
import {
  DB_FILE,
  DEFAULT_PORT,
  PID_FILE,
  PORT_FILE,
  SOCKET_PATH,
  STDIN_SOCKET_PATH,
  VIGIE_HOME,
} from './paths';

function cleanup() {
  try {
    unlinkSync(PID_FILE);
  } catch {}
  try {
    unlinkSync(SOCKET_PATH);
  } catch {}
  try {
    unlinkSync(STDIN_SOCKET_PATH);
  } catch {}
  try {
    unlinkSync(PORT_FILE);
  } catch {}
}

export const runDaemon = Effect.gen(function* () {
  mkdirSync(VIGIE_HOME, { recursive: true, mode: 0o700 });
  writeFileSync(PID_FILE, `${process.pid}\n${Date.now()}`);
  console.log(`[daemon] Started (pid ${process.pid})`);

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
    if (session.agentType === 'claude' && session.claudeSessionId) {
      const resumable = resumabilityChecker.isResumable(session.claudeSessionId, session.cwd);
      if (resumable !== session.resumable) {
        session.setResumable(resumable);
        sessionRepo.save(session);
        session.pullEvents();
      }
    }
  });

  console.log('[daemon] SQLite database opened, orphaned sessions cleaned up');

  const pruneInterval = setInterval(
    () => {
      sessionRepo.pruneOld();
      console.log('[daemon] Pruned old sessions');
    },
    60 * 60 * 1000
  );

  const resumableCheckInterval = setInterval(() => {
    sessionService.checkResumableForActive();
  }, 5_000);

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      console.log('[daemon] Shutting down...');
      clearInterval(pruneInterval);
      clearInterval(resumableCheckInterval);
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
    console.log(`[daemon] Serving client islands from ${clientDistPath}`);
  }

  const routesLayer = createRoutesLayer({
    sessionService,
    eventPublisher,
    terminalSubs,
    clientDistPath,
  });

  const port = Number(process.env.VIGIE_PORT) || DEFAULT_PORT;
  yield* Effect.gen(function* () {
    const httpEffect = yield* HttpRouter.toHttpEffect(routesLayer);
    const server = yield* BunHttpServer.make({ port });
    yield* server.serve(httpEffect, HttpMiddleware.cors());
  }).pipe(
    Effect.provide(BunHttpServer.layerHttpServices),
    Effect.catchDefect((defect) =>
      Effect.sync(() => {
        const msg = defect instanceof Error ? defect.message : String(defect);
        if (msg.includes('EADDRINUSE') || msg.includes('address already in use')) {
          console.error(
            `[daemon] Port ${port} is already in use. Is another vigie daemon running? Stop it with: vigie daemon stop`
          );
        } else {
          console.error('[daemon] HTTP server failed to start:', msg);
        }
        cleanup();
        process.exit(1);
      })
    )
  );

  writeFileSync(PORT_FILE, String(port));
  console.log(`[daemon] HTTP + WebSocket server listening on http://localhost:${port}`);

  // ── 4. IPC Server ─────────────────────────────────────────────────
  if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH);
  if (existsSync(STDIN_SOCKET_PATH)) unlinkSync(STDIN_SOCKET_PATH);

  const router = createIpcRouter(sessionService);
  yield* ipcServer.start(SOCKET_PATH, router, (connId) =>
    Effect.sync(() => sessionService.handleDisconnect(connId))
  );

  console.log(`[daemon] IPC server listening on ${SOCKET_PATH}`);

  // ── 5. Stdin socket ───────────────────────────────────────────────
  Bun.listen({
    unix: STDIN_SOCKET_PATH,
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
        console.error('[stdin-server] error:', err.message);
      },
    },
  });
  console.log(`[daemon] Stdin socket listening on ${STDIN_SOCKET_PATH}`);

  yield* Effect.never;
}).pipe(Effect.scoped);

// ── Composition root ──────────────────────────────────────────────────

const DatabaseLayer = makeDatabaseLayer(DB_FILE);

const InfraLayer = Layer.mergeAll(
  DatabaseLayer,
  SqliteSessionRepositoryLayer.pipe(Layer.provide(DatabaseLayer)),
  SqliteTerminalRepositoryLayer.pipe(Layer.provide(DatabaseLayer)),
  EventPublisherLayer,
  BunPtySpawnerLayer,
  FsResumabilityCheckerLayer,
  AgentRegistryLayer,
  TerminalSubscribersLayer,
  UnixSocketServerLayer
);

export const AppLayer = SessionServiceLayer.pipe(Layer.provideMerge(InfraLayer));

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
    console.error('[daemon] Uncaught exception:', err);
    cleanup();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[daemon] Unhandled rejection:', reason);
    cleanup();
    process.exit(1);
  });

  Effect.runFork(
    runDaemon.pipe(
      Effect.provide(AppLayer),
      Effect.catch((err) =>
        Effect.sync(() => {
          console.error('[daemon] Fatal error:', err);
          cleanup();
          process.exit(1);
        })
      )
    )
  );
}
