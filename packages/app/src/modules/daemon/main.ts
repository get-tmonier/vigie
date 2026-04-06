import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Effect } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { openDatabase } from '#infra/database';
import { createSqliteSessionRepository } from '#modules/session/adapters/secondary/sqlite-session-repository';
import { SessionId } from '#modules/session/domain/session-id';
import { createSessionService } from '#modules/session/session.service';
import { createBunPtySpawner } from '#modules/terminal/adapters/secondary/bun-pty-spawner';
import { createSqliteTerminalRepository } from '#modules/terminal/adapters/secondary/sqlite-terminal-repository';
import { createTerminalSubscribers } from '#modules/terminal/terminal-subscribers';
import { createEventPublisher } from '../daemon/adapters/event-publisher.adapter';
import { createUnixSocketServer } from './adapters/unix-socket-server.adapter';
import type { SessionToDaemon } from './ipc/schemas';
import {
  DB_FILE,
  DEFAULT_PORT,
  PID_FILE,
  PORT_FILE,
  SOCKET_PATH,
  STDIN_SOCKET_PATH,
  VIGIE_HOME,
} from './paths';
import type { IpcConnection } from './ports/ipc-server.port';
import { createRoutesLayer } from './server/server';

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

  // ── 1. Bootstrap: DB, repos, adapters ──────────────────────────────
  const db = openDatabase(DB_FILE);
  const sessionRepo = createSqliteSessionRepository(db);
  const terminalRepo = createSqliteTerminalRepository(db);
  const eventPublisher = createEventPublisher();
  const ptySpawner = createBunPtySpawner();
  const ipcServer = createUnixSocketServer();
  const terminalSubs = createTerminalSubscribers();

  // ── 2. Application service ─────────────────────────────────────────
  const sessionService = createSessionService({
    sessionRepo,
    terminalRepo,
    ptySpawner,
    eventPublisher,
  });

  // Wire IPC + terminal subscriber callbacks
  sessionService.setIpcSendCallback((connId, msg) => {
    Effect.runSync(ipcServer.sendTo(connId, msg));
  });
  sessionService.setTerminalSubscribersCallback((sessionId, data) => {
    terminalSubs.publish(sessionId, data);
  });

  // ── 3. Startup tasks ──────────────────────────────────────────────
  sessionRepo.markOrphanedEnded();
  sessionRepo.pruneOld();

  sessionRepo.findAll().forEach((session) => {
    if (session.agentType === 'claude' && session.claudeSessionId) {
      const resumable = sessionService.checkClaudeSessionResumable(
        session.claudeSessionId,
        session.cwd
      );
      if (resumable !== session.resumable) {
        session.setResumable(resumable);
        sessionRepo.save(session);
        // Don't publish events during startup
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

  // ── 4. HTTP + WebSocket server ─────────────────────────────────────
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

  // ── 5. IPC Server ─────────────────────────────────────────────────
  if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH);
  if (existsSync(STDIN_SOCKET_PATH)) unlinkSync(STDIN_SOCKET_PATH);

  yield* ipcServer.start(
    SOCKET_PATH,
    (conn, msg) => routeIpcMessage(conn, msg, sessionService, ipcServer),
    (connId) => Effect.sync(() => sessionService.handleDisconnect(connId))
  );

  console.log(`[daemon] IPC server listening on ${SOCKET_PATH}`);

  // ── 6. Stdin socket ───────────────────────────────────────────────
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

// ── IPC message router ─────────────────────────────────────────────

function routeIpcMessage(
  conn: IpcConnection,
  msg: SessionToDaemon,
  svc: ReturnType<typeof createSessionService>,
  _ipcServer: { sendTo: (connId: string, data: string) => Effect.Effect<void> }
): Effect.Effect<void> {
  return Effect.gen(function* () {
    switch (msg.type) {
      case 'session:register': {
        svc.register({
          sessionId: msg.sessionId,
          agentType: msg.agentType,
          cwd: msg.cwd,
          mode: msg.mode as 'prompt' | 'interactive' | undefined,
          gitBranch: msg.gitBranch,
          gitRemoteUrl: msg.gitRemoteUrl,
          repoName: msg.repoName,
          connId: conn.id,
        });
        conn.send(JSON.stringify({ type: 'session:registered', sessionId: msg.sessionId }));
        break;
      }
      case 'session:spawn-interactive': {
        svc.connSessions.set(conn.id, msg.sessionId);
        const spawnResult = yield* Effect.result(
          Effect.tryPromise(() =>
            svc.spawnInteractive({
              sessionId: msg.sessionId,
              agentType: msg.agentType,
              cwd: msg.cwd,
              cols: msg.cols,
              rows: msg.rows - 1,
              connId: conn.id,
              claudeSessionId: msg.sessionId,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
            })
          )
        );

        if (spawnResult._tag === 'Failure') {
          const err = spawnResult.failure;
          conn.send(
            JSON.stringify({
              type: 'session:spawn-failed',
              sessionId: msg.sessionId,
              error: err instanceof Error ? err.message : String(err),
            })
          );
          break;
        }

        const { sessionId, entry } = spawnResult.success;
        entry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });
        conn.send(
          JSON.stringify({
            type: 'session:spawned',
            sessionId,
            pid: entry.handle.pid,
          })
        );
        break;
      }
      case 'session:stdin': {
        svc.writeInput(msg.sessionId, msg.data, 'cli');
        break;
      }
      case 'session:cli-resize': {
        const entry = svc.ptyHandles.get(msg.sessionId);
        if (entry?.cliChannels.has(conn.id)) {
          entry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });
          svc.applyResizePriority(msg.sessionId);
          console.log(
            `[daemon] cli-resize sessionId=${msg.sessionId} cols=${msg.cols} rows=${msg.rows}`
          );
        }
        break;
      }
      case 'session:detach': {
        svc.detach(SessionId(msg.sessionId), conn.id);
        break;
      }
      case 'session:attach': {
        const result = svc.attach(SessionId(msg.sessionId), conn.id, {
          cols: msg.cols,
          rows: msg.rows,
        });
        if (result) {
          const entry = svc.ptyHandles.get(msg.sessionId);
          conn.send(
            JSON.stringify({
              type: 'session:spawned',
              sessionId: msg.sessionId,
              pid: entry?.handle.pid,
              ptyCols: msg.cols,
              ptyRows: msg.rows - 1,
              forcedResize: true,
            })
          );
          for (const chunk of result.chunks) {
            conn.send(
              JSON.stringify({
                type: 'session:pty-output',
                sessionId: msg.sessionId,
                data: chunk.data,
              })
            );
          }
          conn.send(
            JSON.stringify({
              type: 'session:replay-complete',
              sessionId: msg.sessionId,
            })
          );
          console.log(
            `[daemon] CLI attached to session ${msg.sessionId} (replayed ${result.chunks.length} chunks)`
          );
        } else {
          conn.send(
            JSON.stringify({
              type: 'session:spawn-failed',
              sessionId: msg.sessionId,
              error: 'Session not found or PTY not running',
            })
          );
        }
        break;
      }
      case 'session:output': {
        // Forwarded from CLI runner — publish to event bus
        svc.ptyHandles; // no-op, this event type is for prompt mode
        break;
      }
      case 'session:done': {
        svc.markEnded(SessionId(msg.sessionId), msg.exitCode);
        console.log(`[daemon] Session done: ${msg.sessionId} (exit ${msg.exitCode})`);
        break;
      }
      case 'session:error': {
        svc.markError(SessionId(msg.sessionId), msg.error);
        console.log(`[daemon] Session error: ${msg.sessionId}: ${msg.error}`);
        break;
      }
      case 'session:terminal-output': {
        // Terminal output from CLI prompt mode
        svc.ptyHandles; // stored + broadcast handled elsewhere for prompt sessions
        break;
      }
      case 'session:resume': {
        svc.connSessions.set(conn.id, msg.sessionId);
        const resumeResult = yield* Effect.result(
          Effect.tryPromise(() =>
            svc.resume(SessionId(msg.sessionId), {
              cols: msg.cols,
              rows: msg.rows,
              connId: conn.id,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
            })
          )
        );

        if (resumeResult._tag === 'Failure') {
          const err = resumeResult.failure;
          conn.send(
            JSON.stringify({
              type: 'session:spawn-failed',
              sessionId: msg.sessionId,
              error: err instanceof Error ? err.message : String(err),
            })
          );
          break;
        }

        const { sessionId: resumedId, entry: resumedEntry } = resumeResult.success;
        resumedEntry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });
        conn.send(
          JSON.stringify({
            type: 'session:spawned',
            sessionId: resumedId,
            pid: resumedEntry.handle.pid,
          })
        );
        break;
      }
      case 'session:claude-id': {
        svc.setClaudeSessionId(SessionId(msg.sessionId), msg.claudeSessionId);
        console.log(
          `[daemon] Claude session ID detected for ${msg.sessionId}: ${msg.claudeSessionId}`
        );
        break;
      }
      case 'session:deregister': {
        svc.deregister(SessionId(msg.sessionId));
        break;
      }
    }
  });
}

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
