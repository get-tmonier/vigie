import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Duration, Effect, Fiber, Schedule } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { VigiDatabase } from '#infra/database';
import type { SessionLifecycleShape } from '#modules/daemon/application/ports/in/session-lifecycle.port';
import type { SpawnSessionShape } from '#modules/daemon/application/ports/in/spawn-session.port';
import type { StartupOpsShape } from '#modules/daemon/application/ports/in/startup-ops.port';
import type { TerminalConnectionShape } from '#modules/daemon/application/ports/in/terminal-connection.port';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createIpcRouter } from '#modules/daemon/infrastructure/adapters/in/ipc-router';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import type { createRoutesLayer } from '#modules/daemon/infrastructure/server';

interface RunDaemonDeps {
  startupOps: StartupOpsShape;
  spawnSession: SpawnSessionShape;
  sessionLifecycle: SessionLifecycleShape;
  terminalConnection: TerminalConnectionShape;
  appRoutes: ReturnType<typeof createRoutesLayer>;
  cleanup: () => void;
}

export function createRunDaemon(deps: RunDaemonDeps) {
  const { startupOps, spawnSession, sessionLifecycle, terminalConnection, cleanup } = deps;

  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const db = yield* VigiDatabase;
    const ipcServer = yield* IpcServer;

    mkdirSync(config.vigieHome, { recursive: true, mode: 0o700 });
    writeFileSync(config.pidFile, `${process.pid}\n${Date.now()}`);
    yield* Effect.logInfo(`[daemon] Started (pid ${process.pid})`);

    // ── 1. Startup cleanup ─────────────────────────────────────────────
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

    // ── 2. HTTP + WebSocket server ─────────────────────────────────────
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

    // ── 3. IPC Server ─────────────────────────────────────────────────
    if (existsSync(config.socketPath)) unlinkSync(config.socketPath);
    if (existsSync(config.stdinSocketPath)) unlinkSync(config.stdinSocketPath);

    const router = createIpcRouter({ spawnSession, sessionLifecycle, terminalConnection });
    yield* ipcServer.start(config.socketPath, router, (connId) =>
      Effect.sync(() => terminalConnection.handleDisconnect(connId))
    );

    yield* Effect.logInfo(`[daemon] IPC server listening on ${config.socketPath}`);

    // ── 4. Stdin socket ───────────────────────────────────────────────
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
          Effect.runFork(Effect.logError(`[stdin-server] error: ${err.message}`));
        },
      },
    });
    yield* Effect.logInfo(`[daemon] Stdin socket listening on ${config.stdinSocketPath}`);

    return yield* Effect.never;
  }).pipe(Effect.scoped);
}
