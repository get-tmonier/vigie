import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Duration, Effect, Fiber, Schedule } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type { AgentSessionServices } from '#modules/agent-session/dependencies';
import { VigiDatabase } from '#shared/db/database';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import { IpcServer } from '#shell/application/ports/out/ipc-server.port';
import { createIpcRouter } from '#shell/infrastructure/adapters/in/ipc-router';
import type { DaemonConfigShape } from '#shell/infrastructure/daemon-config';
import { DaemonConfig } from '#shell/infrastructure/daemon-config';
import type { createRoutesLayer } from '#shell/infrastructure/server';

type RunDaemonDeps = Pick<
  AgentSessionServices,
  'startupOps' | 'spawnSession' | 'sessionLifecycle' | 'ptyManager'
> & {
  appRoutes: ReturnType<typeof createRoutesLayer>;
  cleanup: (config: DaemonConfigShape) => void;
};

export function createRunDaemon(deps: RunDaemonDeps) {
  const { startupOps, spawnSession, sessionLifecycle, ptyManager, cleanup } = deps;

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
        cleanup(config);
      })
    );

    // ── 2. HTTP + WebSocket server ─────────────────────────────────────
    const port = config.port;

    yield* Effect.gen(function* () {
      const httpEffect = yield* HttpRouter.toHttpEffect(deps.appRoutes);
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
          cleanup(config);
          process.exit(1);
        })
      )
    );

    writeFileSync(config.portFile, String(port));
    yield* Effect.logInfo(`[daemon] HTTP + WebSocket server listening on http://localhost:${port}`);

    // ── 3. IPC Server ─────────────────────────────────────────────────
    if (existsSync(config.socketPath)) unlinkSync(config.socketPath);
    if (existsSync(config.stdinSocketPath)) unlinkSync(config.stdinSocketPath);

    const router = createIpcRouter({ spawnSession, sessionLifecycle, ptyManager });
    yield* ipcServer.start(config.socketPath, router, (connId) =>
      Effect.sync(() => ptyManager.handleDisconnect(connId))
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
              ptyManager.writeInput(makeSessionId(parsed.sessionId), parsed.data, 'cli');
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
