import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import * as BunHttpServer from '@effect/platform-bun/BunHttpServer';
import { Effect, Ref } from 'effect';
import * as HttpMiddleware from 'effect/unstable/http/HttpMiddleware';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import { openDatabase } from '#infra/database';
import type { AgentSession } from '../session/domain/session';
import { createSessionService } from '../session/session.service';
import { createEventBus } from '../terminal/event-bus';
import { createTerminalService } from '../terminal/terminal.service';
import { createTerminalSubscribers } from '../terminal/terminal-subscribers';
import { createUnixSocketServer } from './adapters/unix-socket-server.adapter';
import {
  DB_FILE,
  DEFAULT_PORT,
  PID_FILE,
  PORT_FILE,
  SOCKET_PATH,
  STDIN_SOCKET_PATH,
  VIGIE_HOME,
} from './paths';
import { createSessionStore } from './persistence/session-store';
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

  const db = openDatabase(DB_FILE);
  const store = createSessionStore(db);

  store.markOrphanedSessionsEnded();
  store.pruneOldSessions();

  store.recomputeResumable((claudeSessionId, cwd) => {
    const projectDir = cwd.replace(/\//g, '-');
    const filePath = join(homedir(), '.claude', 'projects', projectDir, `${claudeSessionId}.jsonl`);
    return existsSync(filePath);
  });
  console.log('[daemon] SQLite database opened, orphaned sessions cleaned up');

  const pruneInterval = setInterval(
    () => {
      store.pruneOldSessions();
      console.log('[daemon] Pruned old sessions');
    },
    60 * 60 * 1000
  );

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      console.log('[daemon] Shutting down...');
      clearInterval(pruneInterval);
      db.close();
      cleanup();
    })
  );

  const sessions = yield* Ref.make(new Map<string, AgentSession>());
  const sessionService = createSessionService(sessions);

  const eventBus = createEventBus();
  const terminalSubs = createTerminalSubscribers();

  const ipcServer = createUnixSocketServer();

  const terminalService = createTerminalService({
    store,
    eventBus,
    terminalSubs,
    ipcSendTo: (connId, msg) => ipcServer.sendTo(connId, msg),
    onSessionCreated: (session) => sessionService.addSession(session),
    onSessionStatusChange: (sessionId, status) => sessionService.updateStatus(sessionId, status),
  });

  const resumableCheckInterval = setInterval(() => {
    const activeSessions = store.getActiveClaudeSessionsWithId();
    for (const row of activeSessions) {
      const isResumable = terminalService.checkClaudeSessionResumable(
        row.claude_session_id,
        row.cwd
      );
      const wasResumable = row.resumable === 1;
      if (isResumable !== wasResumable) {
        store.setResumable(row.id, isResumable);
        eventBus.publish({
          type: 'session:resumable-changed',
          sessionId: row.id,
          resumable: isResumable,
          timestamp: Date.now(),
        });
        console.log(
          `[daemon] Session ${row.id} resumable changed: ${wasResumable} -> ${isResumable}`
        );
      }
    }

    const recentlyEnded = store.getRecentlyEndedClaudeSessionsWithId(5 * 60 * 1000);
    for (const row of recentlyEnded) {
      if (terminalService.checkClaudeSessionResumable(row.claude_session_id, row.cwd)) {
        store.setResumable(row.id, true);
        eventBus.publish({
          type: 'session:resumable-changed',
          sessionId: row.id,
          resumable: true,
          timestamp: Date.now(),
        });
        console.log(
          `[daemon] Session ${row.id} resumable updated: false -> true (post-exit check)`
        );
      }
    }
  }, 5_000);

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      clearInterval(resumableCheckInterval);
    })
  );

  // ── Embedded HTTP + WebSocket server ──────────────────────────────

  const clientDistCandidates = [
    join(dirname(process.execPath), 'client'),
    resolve(import.meta.dir, '..', '..', '..', '..', '..', 'dist', 'client'),
  ];
  const clientDistPath = clientDistCandidates.find((p) => existsSync(p));
  if (clientDistPath) {
    console.log(`[daemon] Serving client islands from ${clientDistPath}`);
  }

  const spawnSession = async (opts: {
    agentType: string;
    cwd: string;
    cols: number;
    rows: number;
  }): Promise<{ sessionId: string }> => {
    const { sessionId, entry } = await terminalService.doSpawnSession(opts);

    eventBus.publish({
      type: 'session:started',
      sessionId,
      agentType: opts.agentType,
      mode: 'interactive',
      cwd: terminalService.expandPath(opts.cwd),
      timestamp: Date.now(),
    });
    eventBus.publish({
      type: 'session:claude-id-detected',
      sessionId,
      claudeSessionId: sessionId,
      timestamp: Date.now(),
    });

    terminalService.setupPtyLifecycle(sessionId, entry);

    console.log(
      `[daemon] PTY spawned via browser for session ${sessionId} (pid ${entry.handle.pid})`
    );
    return { sessionId };
  };

  const resumeSession = async (
    sessionId: string,
    opts: { cols: number; rows: number }
  ): Promise<{ sessionId: string }> => {
    const session = store.getSessionById(sessionId);
    if (!session?.claude_session_id) {
      throw new Error('No Claude session ID for this session');
    }

    const { entry } = await terminalService.doSpawnSession({
      sessionId,
      agentType: 'claude',
      cwd: session.cwd,
      cols: opts.cols,
      rows: opts.rows,
      resume: true,
      claudeSessionId: session.claude_session_id,
    });

    eventBus.publish({
      type: 'session:started',
      sessionId,
      agentType: 'claude',
      mode: 'interactive',
      cwd: session.cwd,
      timestamp: Date.now(),
    });
    eventBus.publish({
      type: 'session:claude-id-detected',
      sessionId,
      claudeSessionId: session.claude_session_id,
      timestamp: Date.now(),
    });

    terminalService.setupPtyLifecycle(sessionId, entry);

    console.log(
      `[daemon] PTY resumed via browser for session ${sessionId} (pid ${entry.handle.pid})`
    );
    return { sessionId };
  };

  const routesLayer = createRoutesLayer({
    store,
    ptyHandles: terminalService.ptyHandles,
    eventBus,
    terminalSubs,
    applyResizePriority: (id) => terminalService.applyResizePriority(id),
    inputLineBufferWrite: (id, data, src) => terminalService.inputLineBufferWrite(id, data, src),
    clientDistPath,
    spawnSession,
    resumeSession,
  });

  const port = Number(process.env.VIGIE_PORT) || DEFAULT_PORT;
  yield* Effect.gen(function* () {
    const httpEffect = yield* HttpRouter.toHttpEffect(routesLayer);
    const server = yield* BunHttpServer.make({ port });
    yield* server.serve(httpEffect, HttpMiddleware.cors());
  }).pipe(Effect.provide(BunHttpServer.layerHttpServices));

  writeFileSync(PORT_FILE, String(port));
  console.log(`[daemon] HTTP + WebSocket server listening on http://localhost:${port}`);

  // ── IPC Server (Unix socket for CLI commands) ─────────────────────

  if (existsSync(SOCKET_PATH)) {
    unlinkSync(SOCKET_PATH);
  }
  if (existsSync(STDIN_SOCKET_PATH)) {
    unlinkSync(STDIN_SOCKET_PATH);
  }

  yield* ipcServer.start(
    SOCKET_PATH,
    (conn, msg) =>
      Effect.gen(function* () {
        switch (msg.type) {
          case 'session:register': {
            const session: AgentSession = {
              id: msg.sessionId,
              agentType: msg.agentType,
              cwd: msg.cwd,
              gitBranch: msg.gitBranch,
              gitRemoteUrl: msg.gitRemoteUrl,
              repoName: msg.repoName,
              startedAt: Date.now(),
              status: 'active',
            };

            sessionService.addSession(session);
            store.upsertSession(session, msg.mode ?? 'prompt');
            sessionService.sessionConnections.set(msg.sessionId, conn.id);
            sessionService.connSessions.set(conn.id, msg.sessionId);

            conn.send(JSON.stringify({ type: 'session:registered', sessionId: msg.sessionId }));

            eventBus.publish({
              type: 'session:started',
              sessionId: msg.sessionId,
              agentType: msg.agentType,
              mode: msg.mode ?? 'prompt',
              cwd: msg.cwd,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
              timestamp: Date.now(),
            });

            console.log(
              `[daemon] Session registered: ${msg.sessionId} (${msg.agentType}, ${msg.mode ?? 'prompt'})`
            );
            break;
          }
          case 'session:spawn-interactive': {
            sessionService.connSessions.set(conn.id, msg.sessionId);

            const spawnResult = yield* Effect.result(
              Effect.tryPromise(() =>
                terminalService.doSpawnSession({
                  sessionId: msg.sessionId,
                  agentType: msg.agentType,
                  cwd: msg.cwd,
                  cols: msg.cols,
                  rows: msg.rows - 1,
                  claudeSessionId: msg.sessionId,
                })
              )
            );

            if (spawnResult._tag === 'Failure') {
              const err = spawnResult.failure;
              const errorMsg = err instanceof Error ? err.message : String(err);
              conn.send(
                JSON.stringify({
                  type: 'session:spawn-failed',
                  sessionId: msg.sessionId,
                  error: errorMsg,
                })
              );
              console.log(`[daemon] Spawn failed for session ${msg.sessionId}: ${errorMsg}`);
              break;
            }

            const {
              sessionId: spawnedId,
              handle: spawnedHandle,
              entry: spawnedEntry,
            } = spawnResult.success;

            spawnedEntry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });

            conn.send(
              JSON.stringify({
                type: 'session:spawned',
                sessionId: spawnedId,
                pid: spawnedHandle.pid,
              })
            );

            eventBus.publish({
              type: 'session:started',
              sessionId: spawnedId,
              agentType: msg.agentType,
              mode: 'interactive',
              cwd: msg.cwd,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
              timestamp: Date.now(),
            });

            eventBus.publish({
              type: 'session:claude-id-detected',
              sessionId: spawnedId,
              claudeSessionId: spawnedId,
              timestamp: Date.now(),
            });

            terminalService.setupPtyLifecycle(spawnedId, spawnedEntry);

            console.log(
              `[daemon] PTY spawned for session ${spawnedId} (pid ${spawnedHandle.pid}, ${msg.cols}x${msg.rows})`
            );
            break;
          }
          case 'session:stdin': {
            terminalService.writeInput(msg.sessionId, msg.data, 'cli');
            break;
          }
          case 'session:cli-resize': {
            const entry = terminalService.ptyHandles.get(msg.sessionId);
            if (entry?.cliChannels.has(conn.id)) {
              entry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });
              terminalService.applyResizePriority(msg.sessionId);
              console.log(
                `[daemon] cli-resize sessionId=${msg.sessionId} cols=${msg.cols} rows=${msg.rows}`
              );
            }
            break;
          }
          case 'session:detach': {
            const entry = terminalService.ptyHandles.get(msg.sessionId);
            if (entry) {
              entry.cliChannels.delete(conn.id);
              sessionService.connSessions.delete(conn.id);
              terminalService.applyResizePriority(msg.sessionId);
              console.log(`[daemon] CLI detached from session ${msg.sessionId}, PTY kept alive`);
            }
            break;
          }
          case 'session:attach': {
            const entry = terminalService.ptyHandles.get(msg.sessionId);
            if (entry) {
              entry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });
              sessionService.connSessions.set(conn.id, msg.sessionId);

              const cliRows = msg.rows - 1;
              entry.handle.resize(msg.cols, cliRows);
              entry.ptyDimensions = { cols: msg.cols, rows: cliRows };

              eventBus.publish({
                type: 'terminal:pty-resized',
                sessionId: msg.sessionId,
                cols: msg.cols,
                rows: cliRows,
              });

              conn.send(
                JSON.stringify({
                  type: 'session:spawned',
                  sessionId: msg.sessionId,
                  pid: entry.handle.pid,
                  ptyCols: msg.cols,
                  ptyRows: cliRows,
                  forcedResize: true,
                })
              );

              const chunks = store.getAllTerminalChunks(msg.sessionId);
              for (const chunk of chunks) {
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
                `[daemon] CLI attached to session ${msg.sessionId}, PTY forced to ${msg.cols}x${cliRows} (replayed ${chunks.length} chunks)`
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
            eventBus.publish({
              type: 'session:output',
              sessionId: msg.sessionId,
              data: msg.data,
              chunkType: msg.chunkType,
              timestamp: msg.timestamp,
            });
            break;
          }
          case 'session:done': {
            const sessionRow = store.getSessionById(msg.sessionId);
            const resumable =
              sessionRow?.agent_type === 'claude' &&
              sessionRow.claude_session_id != null &&
              terminalService.checkClaudeSessionResumable(
                sessionRow.claude_session_id,
                sessionRow.cwd
              );
            store.markSessionEnded(msg.sessionId, 'ended', msg.exitCode, resumable);
            sessionService.updateStatus(msg.sessionId, 'ended');

            eventBus.publish({
              type: 'session:ended',
              sessionId: msg.sessionId,
              exitCode: msg.exitCode,
              resumable,
              timestamp: msg.timestamp,
            });

            console.log(`[daemon] Session done: ${msg.sessionId} (exit ${msg.exitCode})`);
            break;
          }
          case 'session:error': {
            store.markSessionEnded(msg.sessionId, 'error', -1, false);
            sessionService.updateStatus(msg.sessionId, 'error');

            eventBus.publish({
              type: 'session:error',
              sessionId: msg.sessionId,
              error: msg.error,
              timestamp: msg.timestamp,
            });

            console.log(`[daemon] Session error: ${msg.sessionId}: ${msg.error}`);
            break;
          }
          case 'session:terminal-output': {
            store.appendTerminalChunk(msg.sessionId, msg.data, msg.timestamp);
            terminalSubs.publish(msg.sessionId, msg.data);
            console.log(
              `[daemon] terminal-output: sessionId=${msg.sessionId} bytes=${msg.data.length}`
            );
            break;
          }
          case 'session:resume': {
            sessionService.connSessions.set(conn.id, msg.sessionId);

            const resumeResult = yield* Effect.result(
              Effect.tryPromise(() =>
                terminalService.doSpawnSession({
                  sessionId: msg.sessionId,
                  agentType: 'claude',
                  cwd: msg.cwd,
                  cols: msg.cols,
                  rows: msg.rows,
                  resume: true,
                  claudeSessionId: msg.claudeSessionId,
                })
              )
            );

            if (resumeResult._tag === 'Failure') {
              const err = resumeResult.failure;
              const errorMsg = err instanceof Error ? err.message : String(err);
              conn.send(
                JSON.stringify({
                  type: 'session:spawn-failed',
                  sessionId: msg.sessionId,
                  error: errorMsg,
                })
              );
              console.log(`[daemon] Resume spawn failed for session ${msg.sessionId}: ${errorMsg}`);
              break;
            }

            const {
              sessionId: resumedId,
              handle: resumedHandle,
              entry: resumedEntry,
            } = resumeResult.success;

            resumedEntry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });

            conn.send(
              JSON.stringify({
                type: 'session:spawned',
                sessionId: resumedId,
                pid: resumedHandle.pid,
              })
            );

            eventBus.publish({
              type: 'session:started',
              sessionId: resumedId,
              agentType: 'claude',
              mode: 'interactive',
              cwd: msg.cwd,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
              timestamp: Date.now(),
            });

            eventBus.publish({
              type: 'session:claude-id-detected',
              sessionId: resumedId,
              claudeSessionId: msg.claudeSessionId,
              timestamp: Date.now(),
            });

            terminalService.setupPtyLifecycle(resumedId, resumedEntry);

            console.log(
              `[daemon] PTY resumed for session ${resumedId} (pid ${resumedHandle.pid}, claude session ${msg.claudeSessionId})`
            );
            break;
          }
          case 'session:claude-id': {
            store.updateClaudeSessionId(msg.sessionId, msg.claudeSessionId);
            eventBus.publish({
              type: 'session:claude-id-detected',
              sessionId: msg.sessionId,
              claudeSessionId: msg.claudeSessionId,
              timestamp: Date.now(),
            });
            console.log(
              `[daemon] Claude session ID detected for ${msg.sessionId}: ${msg.claudeSessionId}`
            );
            break;
          }
          case 'session:deregister': {
            store.markSessionEnded(msg.sessionId, 'ended', 0, false);
            sessionService.removeSession(msg.sessionId);

            const connId = sessionService.sessionConnections.get(msg.sessionId);
            if (connId) {
              sessionService.connSessions.delete(connId);
            }
            sessionService.sessionConnections.delete(msg.sessionId);

            eventBus.publish({
              type: 'session:ended',
              sessionId: msg.sessionId,
              exitCode: 0,
              resumable: false,
              timestamp: Date.now(),
            });

            console.log(`[daemon] Session deregistered: ${msg.sessionId}`);
            break;
          }
        }
      }),
    (connId) =>
      Effect.sync(() => {
        const sessionId = sessionService.connSessions.get(connId);
        if (sessionId) {
          const entry = terminalService.ptyHandles.get(sessionId);

          if (entry) {
            entry.cliChannels.delete(connId);
            sessionService.connSessions.delete(connId);
            terminalService.applyResizePriority(sessionId);
            console.log(`[daemon] CLI connection lost for session ${sessionId}, PTY kept alive`);
          } else {
            const sessionRow = store.getSessionById(sessionId);
            const alreadyEnded = sessionRow?.status === 'ended' || sessionRow?.status === 'error';

            if (!alreadyEnded) {
              store.markSessionEnded(sessionId, 'ended', -1, false);
              eventBus.publish({
                type: 'session:ended',
                sessionId,
                exitCode: -1,
                resumable: false,
                timestamp: Date.now(),
              });
              console.log(`[daemon] Connection lost for session: ${sessionId}`);
            }

            sessionService.removeSession(sessionId);
            sessionService.sessionConnections.delete(sessionId);
            sessionService.connSessions.delete(connId);
          }
        }
      })
  );

  console.log(`[daemon] IPC server listening on ${SOCKET_PATH}`);

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
            terminalService.writeInput(parsed.sessionId, parsed.data, 'cli');
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
