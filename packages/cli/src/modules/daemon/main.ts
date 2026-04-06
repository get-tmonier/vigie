import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { ServerWebSocket } from 'bun';
import { Effect, Ref } from 'effect';
import type { InteractiveRunnerHandle } from '../session/adapters/agents/agent-interactive-runner.adapter.js';
import { spawnAgentInteractive } from '../session/adapters/agents/agent-interactive-runner.adapter.js';
import { resolveAgent } from '../session/domain/agent-config.js';
import type { AgentSession } from '../session/domain/session.js';
import { createUnixSocketServer } from './adapters/unix-socket-server.adapter.js';
import type { LineBuffer } from './input-line-buffer.js';
import { stripAnsiAndBuffer } from './input-line-buffer.js';
import {
  DB_FILE,
  DEFAULT_PORT,
  PID_FILE,
  PORT_FILE,
  SOCKET_PATH,
  STDIN_SOCKET_PATH,
  VIGIE_HOME,
} from './paths.js';
import { openDatabase } from './persistence/database.js';
import { createSessionStore } from './persistence/session-store.js';
import type { PtyEntry } from './server/app.js';
import { createServerApp } from './server/app.js';
import { createEventBus } from './server/event-bus.js';
import { createTerminalSubscribers } from './server/terminal-subscribers.js';
import type { WsData } from './server/websocket.js';
import { createWebSocketHandlers } from './server/websocket.js';

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

  // Open SQLite database
  const db = openDatabase(DB_FILE);
  const store = createSessionStore(db);

  // Mark any orphaned active sessions from a previous daemon run as ended
  store.markOrphanedSessionsEnded();
  // Prune old ended sessions (>24h)
  store.pruneOldSessions();

  // Recompute resumable from Claude's actual files (source of truth)
  store.recomputeResumable((claudeSessionId, cwd) => {
    const projectDir = cwd.replace(/\//g, '-');
    const filePath = join(homedir(), '.claude', 'projects', projectDir, `${claudeSessionId}.jsonl`);
    return existsSync(filePath);
  });
  console.log('[daemon] SQLite database opened, orphaned sessions cleaned up');

  // Hourly cleanup interval
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

  // Session state
  const sessions = yield* Ref.make(new Map<string, AgentSession>());
  const sessionConnections = new Map<string, string>(); // sessionId → connId
  const connSessions = new Map<string, string>(); // connId → sessionId

  // PTY state — daemon owns all interactive PTYs
  const ptyHandles = new Map<string, PtyEntry>();

  // Input line buffers for escape sequence stripping
  const inputLineBuffers = new Map<string, LineBuffer>();

  // Event bus for broadcasting to browser clients
  const eventBus = createEventBus();

  // Terminal subscribers for streaming PTY output to browser xterm.js
  const terminalSubs = createTerminalSubscribers();

  function expandPath(p: string): string {
    if (p === '~' || p.startsWith('~/')) {
      return resolve(homedir(), p.slice(2) || '.');
    }
    return resolve(p);
  }

  function cwdToProjectDir(cwd: string): string {
    return cwd.replace(/\//g, '-');
  }

  function checkClaudeSessionResumable(claudeSessionId: string, cwd: string): boolean {
    const projectDir = cwdToProjectDir(cwd);
    const claudeDir = join(homedir(), '.claude', 'projects', projectDir);
    return existsSync(join(claudeDir, `${claudeSessionId}.jsonl`));
  }

  function applyResizePriority(sessionId: string): { cols: number; rows: number } | null {
    const entry = ptyHandles.get(sessionId);
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

    // Notify ALL CLI channels so each can resize its VTerm to match new PTY dims
    for (const connId of entry.cliChannels.keys()) {
      Effect.runSync(
        ipcServer.sendTo(
          connId,
          JSON.stringify({ type: 'session:pty-resized', sessionId, ptyCols: cols, ptyRows: rows })
        )
      );
    }

    // Notify browser clients
    eventBus.publish({ type: 'terminal:pty-resized', sessionId, cols, rows });

    return { cols, rows };
  }

  function inputLineBufferWrite(sessionId: string, base64Data: string, source: 'cli' | 'browser') {
    stripAnsiAndBuffer(inputLineBuffers, sessionId, base64Data, source, (text, src, timestamp) => {
      store.appendInputEntry(sessionId, text, src, timestamp);
      eventBus.publish({
        type: 'terminal:input-echo',
        sessionId,
        text,
        source: src,
        timestamp,
      });
    });
  }

  /**
   * Common PTY lifecycle setup: registers output and exit handlers.
   * MUST be called AFTER notifying CLI/browser that the session started,
   * because onOutput() drains buffered PTY data synchronously.
   */
  function setupPtyLifecycle(sessionId: string, entry: PtyEntry) {
    entry.handle.onOutput((data: Uint8Array) => {
      const base64 = Buffer.from(data).toString('base64');
      const ts = Date.now();
      store.appendTerminalChunk(sessionId, base64, ts);

      // Fan-out to CLI channels
      for (const connId of entry.cliChannels.keys()) {
        Effect.runSync(
          ipcServer.sendTo(
            connId,
            JSON.stringify({ type: 'session:pty-output', sessionId, data: base64 })
          )
        );
      }

      // Fan-out to browser terminal WS clients
      terminalSubs.publish(sessionId, base64);
    });

    entry.handle.wait().then((exitCode: number) => {
      const sessionRow = store.getSessionById(sessionId);
      const resumable =
        sessionRow?.agent_type === 'claude' &&
        sessionRow.claude_session_id != null &&
        checkClaudeSessionResumable(sessionRow.claude_session_id, sessionRow.cwd);
      store.markSessionEnded(sessionId, 'ended', exitCode, resumable);

      // Notify CLI channels
      for (const connId of entry.cliChannels.keys()) {
        Effect.runSync(
          ipcServer.sendTo(
            connId,
            JSON.stringify({ type: 'session:pty-exited', sessionId, exitCode })
          )
        );
      }

      // Notify browser clients
      eventBus.publish({
        type: 'session:ended',
        sessionId,
        exitCode,
        resumable,
        timestamp: Date.now(),
      });

      Effect.runSync(
        Ref.update(sessions, (map) => {
          const newMap = new Map(map);
          const s = newMap.get(sessionId);
          if (s) {
            newMap.set(sessionId, { ...s, status: 'ended' });
          }
          return newMap;
        })
      );

      ptyHandles.delete(sessionId);
      console.log(`[daemon] PTY exited for session ${sessionId} (exit ${exitCode})`);
    });
  }

  /**
   * Spawn a new interactive PTY session (callable from both REST and IPC).
   */
  async function doSpawnSession(opts: {
    sessionId?: string;
    agentType: string;
    cwd: string;
    cols: number;
    rows: number;
    claudeSessionId?: string;
    resume?: boolean;
  }): Promise<{ sessionId: string; handle: InteractiveRunnerHandle; entry: PtyEntry }> {
    const sessionId = opts.sessionId ?? crypto.randomUUID();
    const resolvedCwd = expandPath(opts.cwd);

    const session: AgentSession = {
      id: sessionId,
      agentType: opts.agentType as AgentSession['agentType'],
      cwd: resolvedCwd,
      startedAt: Date.now(),
      status: 'active',
    };

    Effect.runSync(Ref.update(sessions, (map) => new Map([...map, [sessionId, session]])));
    store.upsertSession(session, 'interactive');
    store.updateClaudeSessionId(sessionId, opts.claudeSessionId ?? sessionId);

    if (opts.resume) {
      store.reactivateSession(sessionId);
    }

    const agent = resolveAgent(opts.agentType);
    const handle = await Effect.runPromise(
      spawnAgentInteractive(agent, resolvedCwd, opts.cols, opts.rows, {
        resume: opts.resume,
        claudeSessionId: opts.claudeSessionId ?? sessionId,
      })
    );

    const entry: PtyEntry = {
      handle,
      cliChannels: new Map(),
      browserChannels: new Map(),
      ptyDimensions: { cols: opts.cols, rows: opts.rows },
    };
    ptyHandles.set(sessionId, entry);

    return { sessionId, handle, entry };
  }

  // IPC Server (created early so spawn helpers can reference it)
  const ipcServer = createUnixSocketServer();

  // Periodically check if active Claude sessions are resumable
  const resumableCheckInterval = setInterval(() => {
    const activeSessions = store.getActiveClaudeSessionsWithId();
    for (const row of activeSessions) {
      const isResumable = checkClaudeSessionResumable(row.claude_session_id, row.cwd);
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

    // Safety net: recently-ended sessions not yet marked resumable
    const recentlyEnded = store.getRecentlyEndedClaudeSessionsWithId(5 * 60 * 1000);
    for (const row of recentlyEnded) {
      if (checkClaudeSessionResumable(row.claude_session_id, row.cwd)) {
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

  // Resolve UI dist path — check multiple locations
  const uiDistCandidates = [
    join(dirname(process.execPath), 'ui-dist'), // compiled binary: ./ui-dist/
    join(dirname(process.execPath), '..', 'ui-dist'), // npm global: ../ui-dist/
    resolve(import.meta.dir, '..', '..', '..', '..', 'ui', 'dist'), // dev: packages/ui/dist/
  ];
  const uiDistPath = uiDistCandidates.find((p) => existsSync(p));
  if (uiDistPath) {
    console.log(`[daemon] Serving UI from ${uiDistPath}`);
  } else if (!process.env.VIGIE_DEV) {
    console.log('[daemon] No UI dist found — API-only mode');
  }

  const serverApp = createServerApp({
    store,
    ptyHandles,
    eventBus,
    terminalSubs,
    applyResizePriority,
    inputLineBufferWrite,
    uiDistPath,
    spawnSession: async (opts) => {
      const { sessionId, entry } = await doSpawnSession(opts);

      // Notify browser clients
      eventBus.publish({
        type: 'session:started',
        sessionId,
        agentType: opts.agentType,
        mode: 'interactive',
        cwd: expandPath(opts.cwd),
        timestamp: Date.now(),
      });
      eventBus.publish({
        type: 'session:claude-id-detected',
        sessionId,
        claudeSessionId: sessionId,
        timestamp: Date.now(),
      });

      // Register output + exit handlers AFTER notifications
      setupPtyLifecycle(sessionId, entry);

      console.log(
        `[daemon] PTY spawned via browser for session ${sessionId} (pid ${entry.handle.pid})`
      );
      return { sessionId };
    },
    resumeSession: async (sessionId, opts) => {
      const session = store.getSessionById(sessionId);
      if (!session?.claude_session_id) {
        throw new Error('No Claude session ID for this session');
      }

      const { entry } = await doSpawnSession({
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

      setupPtyLifecycle(sessionId, entry);

      console.log(
        `[daemon] PTY resumed via browser for session ${sessionId} (pid ${entry.handle.pid})`
      );
      return { sessionId };
    },
  });

  const wsHandlers = createWebSocketHandlers({
    store,
    ptyHandles,
    eventBus,
    terminalSubs,
    applyResizePriority,
    inputLineBufferWrite,
  });

  const port = Number(process.env.VIGIE_PORT) || DEFAULT_PORT;
  const httpServer = Bun.serve<WsData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade for /ws/events
      if (url.pathname === '/ws/events') {
        const upgraded = server.upgrade(req, {
          data: { type: 'events' as const },
        });
        if (upgraded) return undefined;
        return new Response('WebSocket upgrade failed', { status: 400 });
      }

      // WebSocket upgrade for /ws/terminal/:sessionId
      const terminalMatch = url.pathname.match(/^\/ws\/terminal\/(.+)$/);
      if (terminalMatch) {
        const sessionId = terminalMatch[1];
        const browserConnId = crypto.randomUUID();
        const upgraded = server.upgrade(req, {
          data: {
            type: 'terminal' as const,
            sessionId,
            browserConnId,
          },
        });
        if (upgraded) return undefined;
        return new Response('WebSocket upgrade failed', { status: 400 });
      }

      // Regular HTTP requests → Hono
      return serverApp.fetch(req);
    },
    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        wsHandlers.open(ws);
      },
      message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
        wsHandlers.message(ws, message);
      },
      close(ws: ServerWebSocket<WsData>) {
        wsHandlers.close(ws);
      },
    },
  });

  writeFileSync(PORT_FILE, String(port));
  console.log(`[daemon] HTTP + WebSocket server listening on http://localhost:${port}`);

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      httpServer.stop();
    })
  );

  // ── IPC Server (Unix socket for CLI commands) ─────────────────────

  // Clean up stale sockets
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

            yield* Ref.update(sessions, (map) => new Map([...map, [msg.sessionId, session]]));
            store.upsertSession(session, msg.mode ?? 'prompt');
            sessionConnections.set(msg.sessionId, conn.id);
            connSessions.set(conn.id, msg.sessionId);

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
            connSessions.set(conn.id, msg.sessionId);

            const spawnResult = yield* Effect.result(
              Effect.tryPromise(() =>
                doSpawnSession({
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

            // CRITICAL ORDER: notify CLI BEFORE registering onOutput
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

            // NOW register output + exit handlers
            setupPtyLifecycle(spawnedId, spawnedEntry);

            console.log(
              `[daemon] PTY spawned for session ${spawnedId} (pid ${spawnedHandle.pid}, ${msg.cols}x${msg.rows})`
            );

            break;
          }
          case 'session:stdin': {
            const entry = ptyHandles.get(msg.sessionId);
            if (entry) {
              const bytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              entry.handle.write(bytes);
              inputLineBufferWrite(msg.sessionId, msg.data, 'cli');
            }
            break;
          }
          case 'session:cli-resize': {
            const entry = ptyHandles.get(msg.sessionId);
            if (entry?.cliChannels.has(conn.id)) {
              entry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });
              applyResizePriority(msg.sessionId);
              console.log(
                `[daemon] cli-resize sessionId=${msg.sessionId} cols=${msg.cols} rows=${msg.rows}`
              );
            }
            break;
          }
          case 'session:detach': {
            const entry = ptyHandles.get(msg.sessionId);
            if (entry) {
              entry.cliChannels.delete(conn.id);
              connSessions.delete(conn.id);
              applyResizePriority(msg.sessionId);
              console.log(`[daemon] CLI detached from session ${msg.sessionId}, PTY kept alive`);
            }
            break;
          }
          case 'session:attach': {
            const entry = ptyHandles.get(msg.sessionId);
            if (entry) {
              entry.cliChannels.set(conn.id, { cols: msg.cols, rows: msg.rows });
              connSessions.set(conn.id, msg.sessionId);

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

              // Replay full terminal history
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
              checkClaudeSessionResumable(sessionRow.claude_session_id, sessionRow.cwd);
            store.markSessionEnded(msg.sessionId, 'ended', msg.exitCode, resumable);
            yield* Ref.update(sessions, (map) => {
              const newMap = new Map(map);
              const session = newMap.get(msg.sessionId);
              if (session) {
                newMap.set(msg.sessionId, { ...session, status: 'ended' });
              }
              return newMap;
            });

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
            yield* Ref.update(sessions, (map) => {
              const newMap = new Map(map);
              const session = newMap.get(msg.sessionId);
              if (session) {
                newMap.set(msg.sessionId, { ...session, status: 'error' });
              }
              return newMap;
            });

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
            connSessions.set(conn.id, msg.sessionId);

            const resumeResult = yield* Effect.result(
              Effect.tryPromise(() =>
                doSpawnSession({
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

            setupPtyLifecycle(resumedId, resumedEntry);

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
            yield* Ref.update(sessions, (map) => {
              const newMap = new Map(map);
              newMap.delete(msg.sessionId);
              return newMap;
            });

            const connId = sessionConnections.get(msg.sessionId);
            if (connId) {
              connSessions.delete(connId);
            }
            sessionConnections.delete(msg.sessionId);

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
      Effect.gen(function* () {
        const sessionId = connSessions.get(connId);
        if (sessionId) {
          const entry = ptyHandles.get(sessionId);

          if (entry) {
            entry.cliChannels.delete(connId);
            connSessions.delete(connId);
            applyResizePriority(sessionId);
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

            yield* Ref.update(sessions, (map) => {
              const newMap = new Map(map);
              newMap.delete(sessionId);
              return newMap;
            });
            sessionConnections.delete(sessionId);
            connSessions.delete(connId);
          }
        }
      })
  );

  console.log(`[daemon] IPC server listening on ${SOCKET_PATH}`);

  // Dedicated stdin socket
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
            const sid = parsed.sessionId;
            const entry = ptyHandles.get(sid);
            if (entry) {
              const bytes = Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0));
              entry.handle.write(bytes);
              inputLineBufferWrite(sid, parsed.data, 'cli');
            }
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

  // Keep alive
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
