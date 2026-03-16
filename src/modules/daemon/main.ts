import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Effect, Ref } from 'effect';
import * as v from 'valibot';
import { executeCommand } from '../../execution/executor.js';
import { DownstreamMessageSchema } from '../../schemas/messages.js';
import { config } from '../auth/config.js';
import { getCredentials } from '../auth/credentials.js';
import { createWebSocketClient } from '../backend/adapters/websocket-client.adapter.js';
import type { InteractiveRunnerHandle } from '../session/adapters/agents/claude-interactive-runner.adapter.js';
import { spawnClaudeInteractive } from '../session/adapters/agents/claude-interactive-runner.adapter.js';
import type { AgentSession } from '../session/domain/session.js';
import { createUnixSocketServer } from './adapters/unix-socket-server.adapter.js';
import type { LineBuffer } from './input-line-buffer.js';
import { stripAnsiAndBuffer } from './input-line-buffer.js';
import { DB_FILE, PID_FILE, SOCKET_PATH, STDIN_SOCKET_PATH, TMONIER_HOME } from './paths.js';
import { openDatabase } from './persistence/database.js';
import { createSessionStore } from './persistence/session-store.js';

interface PtyEntry {
  handle: InteractiveRunnerHandle;
  cliConnId: string | null;
  cliDimensions: { cols: number; rows: number };
  browserDimensions: { cols: number; rows: number } | null;
  browserConnected: boolean;
}

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
}

export const runDaemon = Effect.gen(function* () {
  mkdirSync(TMONIER_HOME, { recursive: true, mode: 0o700 });

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

  // Load credentials
  const creds = yield* Effect.promise(() => getCredentials());
  const token = config.TMONIER_TOKEN ?? creds?.token;
  if (!token) {
    console.error('[daemon] No API key found. Run `tmonier login` first.');
    process.exit(1);
  }

  // Session state
  const sessions = yield* Ref.make(new Map<string, AgentSession>());
  const sessionConnections = new Map<string, string>(); // sessionId → connId
  const connSessions = new Map<string, string>(); // connId → sessionId

  // PTY state — daemon owns all interactive PTYs
  const ptyHandles = new Map<string, PtyEntry>();

  // Input line buffers for escape sequence stripping
  const inputLineBuffers = new Map<string, LineBuffer>();

  function expandPath(p: string): string {
    if (p === '~' || p.startsWith('~/')) {
      return resolve(homedir(), p.slice(2) || '.');
    }
    return resolve(p);
  }

  function applyResizePriority(sessionId: string): void {
    const entry = ptyHandles.get(sessionId);
    if (!entry) return;

    if (entry.browserConnected && entry.browserDimensions) {
      entry.handle.resize(entry.browserDimensions.cols, entry.browserDimensions.rows);
    } else if (entry.cliConnId && entry.cliDimensions) {
      entry.handle.resize(entry.cliDimensions.cols, entry.cliDimensions.rows);
    }
  }

  // IPC Server (created early so WS handler can reference it)
  const ipcServer = createUnixSocketServer();

  // Build sync message from SQLite state
  function buildSyncMessage() {
    const allSessions = store.getAllSessions();
    const syncSessions = allSessions.map((row) => {
      const chunks = store.getTerminalChunks(row.id, 500);
      const inputHistory = store.getInputHistory(row.id);
      return {
        sessionId: row.id,
        agentType: row.agent_type as 'claude' | 'opencode' | 'generic',
        mode: row.mode as 'prompt' | 'interactive',
        cwd: row.cwd,
        gitBranch: row.git_branch ?? undefined,
        repoName: row.repo_name ?? undefined,
        startedAt: row.started_at,
        status: row.status as 'active' | 'ended' | 'error',
        exitCode: row.exit_code ?? undefined,
        claudeSessionId: row.claude_session_id ?? undefined,
        resumable: row.resumable === 1,
        terminalChunks: chunks,
        inputHistory,
      };
    });
    return { type: 'daemon:sync' as const, sessions: syncSessions };
  }

  // Backend WebSocket — with offline queue and reconnect sync
  const wsClient = createWebSocketClient({
    onOfflineSend: (msg) => {
      store.enqueue(msg);
      console.log('[daemon] Message queued (WS offline)');
    },
    onConnect: () => {
      // Send full sync on every connect (initial + reconnect)
      const syncMsg = buildSyncMessage();
      if (syncMsg.sessions.length > 0) {
        Effect.runSync(wsClient.send(syncMsg));
        console.log(`[daemon] Sent daemon:sync with ${syncMsg.sessions.length} sessions`);
      }
    },
    onReconnect: () => {
      console.log('[daemon] Reconnected — draining offline queue...');

      // Drain offline queue FIFO
      const queued = store.drainQueue();
      for (const item of queued) {
        Effect.runSync(wsClient.send(item.payload));
        store.deleteQueueItem(item.id);
      }
      if (queued.length > 0) {
        console.log(`[daemon] Drained ${queued.length} queued messages`);
      }
    },
  });

  // Periodically check if active Claude sessions are resumable by checking
  // if their conversation file exists in Claude's local storage
  function cwdToProjectDir(cwd: string): string {
    return cwd.replace(/\//g, '-');
  }

  function checkClaudeSessionResumable(claudeSessionId: string, cwd: string): boolean {
    const projectDir = cwdToProjectDir(cwd);
    const claudeDir = join(homedir(), '.claude', 'projects', projectDir);
    return existsSync(join(claudeDir, `${claudeSessionId}.jsonl`));
  }

  const resumableCheckInterval = setInterval(() => {
    const activeSessions = store.getActiveClaudeSessionsWithId();
    for (const row of activeSessions) {
      const isResumable = checkClaudeSessionResumable(row.claude_session_id, row.cwd);
      const wasResumable = row.resumable === 1;
      if (isResumable !== wasResumable) {
        store.setResumable(row.id, isResumable);
        Effect.runSync(
          wsClient.send({
            type: 'session:resumable-changed',
            sessionId: row.id,
            resumable: isResumable,
            timestamp: Date.now(),
          })
        );
        console.log(
          `[daemon] Session ${row.id} resumable changed: ${wasResumable} -> ${isResumable}`
        );
      }
    }
  }, 5_000);

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      clearInterval(resumableCheckInterval);
    })
  );

  wsClient.onMessage((data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    const result = v.safeParse(DownstreamMessageSchema, parsed);
    if (!result.success) return;

    const msg = result.output;
    switch (msg.type) {
      case 'command:request': {
        executeCommand(msg, (upstream) => wsClient.send(upstream).pipe(Effect.runSync));
        break;
      }
      case 'ping': {
        Effect.runSync(wsClient.send({ type: 'pong' }));
        break;
      }
      case 'terminal:input': {
        // Write directly to PTY (daemon owns the PTY now)
        const entry = ptyHandles.get(msg.sessionId);
        if (entry) {
          const bytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
          entry.handle.write(bytes);
          // Strip escape sequences and buffer lines for input history
          stripAnsiAndBuffer(
            inputLineBuffers,
            msg.sessionId,
            msg.data,
            'browser',
            (text, source, timestamp) => {
              store.appendInputEntry(msg.sessionId, text, source, timestamp);
              Effect.runSync(
                wsClient.send({
                  type: 'terminal:input-echo',
                  sessionId: msg.sessionId,
                  text,
                  source,
                  timestamp,
                })
              );
            }
          );
        }
        break;
      }
      case 'terminal:resize': {
        const entry = ptyHandles.get(msg.sessionId);
        if (entry) {
          entry.browserConnected = true;
          entry.browserDimensions = { cols: msg.cols, rows: msg.rows };
          applyResizePriority(msg.sessionId);
          console.log(
            `[daemon] terminal:resize (browser) sessionId=${msg.sessionId} cols=${msg.cols} rows=${msg.rows}`
          );
        }
        break;
      }
      case 'terminal:browser-disconnected': {
        const entry = ptyHandles.get(msg.sessionId);
        if (entry) {
          entry.browserConnected = false;
          applyResizePriority(msg.sessionId);
          console.log(
            `[daemon] Browser disconnected for session ${msg.sessionId}, reverted to CLI dimensions`
          );
        }
        break;
      }
      case 'session:spawn-request': {
        const resolvedCwd = expandPath(msg.cwd);
        const session: AgentSession = {
          id: msg.sessionId,
          agentType: msg.agentType,
          cwd: resolvedCwd,
          startedAt: Date.now(),
          status: 'active',
        };

        Effect.runSync(Ref.update(sessions, (map) => new Map([...map, [msg.sessionId, session]])));
        store.upsertSession(session, 'interactive');

        store.updateClaudeSessionId(msg.sessionId, msg.sessionId);

        Effect.runPromise(
          spawnClaudeInteractive(resolvedCwd, msg.cols, msg.rows, {
            claudeSessionId: msg.sessionId,
          })
        )
          .then((handle) => {
            const entry: PtyEntry = {
              handle,
              cliConnId: null,
              cliDimensions: { cols: msg.cols, rows: msg.rows - 1 },
              browserDimensions: { cols: msg.cols, rows: msg.rows },
              browserConnected: true,
            };
            ptyHandles.set(msg.sessionId, entry);

            // Notify backend (creates TerminalRelay in API)
            Effect.runSync(
              wsClient.send({
                type: 'session:started',
                sessionId: msg.sessionId,
                agentType: msg.agentType,
                mode: 'interactive',
                cwd: resolvedCwd,
                timestamp: Date.now(),
              })
            );

            Effect.runSync(
              wsClient.send({
                type: 'session:claude-id-detected',
                sessionId: msg.sessionId,
                claudeSessionId: msg.sessionId,
                timestamp: Date.now(),
              })
            );

            // Register output handler — drains buffered PTY data
            handle.onOutput((outputData: Uint8Array) => {
              const base64 = Buffer.from(outputData).toString('base64');
              const ts = Date.now();
              store.appendTerminalChunk(msg.sessionId, base64, ts);

              // Send to CLI if attached
              if (entry.cliConnId) {
                Effect.runSync(
                  ipcServer.sendTo(
                    entry.cliConnId,
                    JSON.stringify({
                      type: 'session:pty-output',
                      sessionId: msg.sessionId,
                      data: base64,
                    })
                  )
                );
              }

              // Send to backend (for browser)
              Effect.runSync(
                wsClient.send({
                  type: 'terminal:output',
                  sessionId: msg.sessionId,
                  data: base64,
                  timestamp: ts,
                })
              );
            });

            // Monitor for PTY exit
            handle.wait().then((exitCode: number) => {
              const resumable = store.markSessionEnded(msg.sessionId, 'ended', exitCode);
              Effect.runSync(
                wsClient.send({
                  type: 'session:ended',
                  sessionId: msg.sessionId,
                  exitCode,
                  resumable,
                  timestamp: Date.now(),
                })
              );

              Effect.runSync(
                Ref.update(sessions, (map) => {
                  const newMap = new Map(map);
                  const s = newMap.get(msg.sessionId);
                  if (s) {
                    newMap.set(msg.sessionId, { ...s, status: 'ended' });
                  }
                  return newMap;
                })
              );

              ptyHandles.delete(msg.sessionId);
              console.log(
                `[daemon] PTY exited for browser-spawned session ${msg.sessionId} (exit ${exitCode})`
              );
            });

            console.log(
              `[daemon] PTY spawned via browser for session ${msg.sessionId} (pid ${handle.pid}, ${msg.cols}x${msg.rows})`
            );
          })
          .catch((err) => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            Effect.runSync(
              wsClient.send({
                type: 'session:spawn-failed',
                sessionId: msg.sessionId,
                error: errorMsg,
                timestamp: Date.now(),
              })
            );
            console.log(`[daemon] Browser spawn failed for session ${msg.sessionId}: ${errorMsg}`);
          });
        break;
      }
      case 'session:kill': {
        const entry = ptyHandles.get(msg.sessionId);
        if (entry) {
          entry.handle.kill();
          console.log(`[daemon] Kill requested for session ${msg.sessionId}`);
        }
        break;
      }
      case 'fs:list-dir': {
        const dirPath = expandPath(msg.path);
        try {
          const items = readdirSync(dirPath, { withFileTypes: true });
          const entries = items
            .filter((item) => !item.name.startsWith('.'))
            .map((item) => ({ name: item.name, isDirectory: item.isDirectory() }))
            .sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
          Effect.runSync(
            wsClient.send({
              type: 'fs:list-dir-response',
              requestId: msg.requestId,
              entries,
            })
          );
        } catch (err) {
          Effect.runSync(
            wsClient.send({
              type: 'fs:list-dir-response',
              requestId: msg.requestId,
              entries: [],
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
        break;
      }
      case 'session:resume-request': {
        const resolvedCwd = expandPath(msg.cwd);
        const existingSession = store.getSession(msg.sessionId);
        const session: AgentSession = existingSession
          ? { ...existingSession, status: 'active' }
          : {
              id: msg.sessionId,
              agentType: 'claude',
              cwd: resolvedCwd,
              startedAt: Date.now(),
              status: 'active',
            };

        Effect.runSync(Ref.update(sessions, (map) => new Map([...map, [msg.sessionId, session]])));
        store.reactivateSession(msg.sessionId);

        Effect.runPromise(
          spawnClaudeInteractive(resolvedCwd, msg.cols, msg.rows, {
            resume: true,
            claudeSessionId: msg.claudeSessionId,
          })
        )
          .then((handle) => {
            const entry: PtyEntry = {
              handle,
              cliConnId: null,
              cliDimensions: { cols: msg.cols, rows: msg.rows - 1 },
              browserDimensions: { cols: msg.cols, rows: msg.rows },
              browserConnected: true,
            };
            ptyHandles.set(msg.sessionId, entry);

            Effect.runSync(
              wsClient.send({
                type: 'session:started',
                sessionId: msg.sessionId,
                agentType: 'claude',
                mode: 'interactive',
                cwd: resolvedCwd,
                timestamp: Date.now(),
              })
            );

            Effect.runSync(
              wsClient.send({
                type: 'session:claude-id-detected',
                sessionId: msg.sessionId,
                claudeSessionId: msg.claudeSessionId,
                timestamp: Date.now(),
              })
            );

            handle.onOutput((outputData: Uint8Array) => {
              const base64 = Buffer.from(outputData).toString('base64');
              const ts = Date.now();
              store.appendTerminalChunk(msg.sessionId, base64, ts);

              if (entry.cliConnId) {
                Effect.runSync(
                  ipcServer.sendTo(
                    entry.cliConnId,
                    JSON.stringify({
                      type: 'session:pty-output',
                      sessionId: msg.sessionId,
                      data: base64,
                    })
                  )
                );
              }

              Effect.runSync(
                wsClient.send({
                  type: 'terminal:output',
                  sessionId: msg.sessionId,
                  data: base64,
                  timestamp: ts,
                })
              );
            });

            handle.wait().then((exitCode: number) => {
              const resumable = store.markSessionEnded(msg.sessionId, 'ended', exitCode);
              Effect.runSync(
                wsClient.send({
                  type: 'session:ended',
                  sessionId: msg.sessionId,
                  exitCode,
                  resumable,
                  timestamp: Date.now(),
                })
              );

              Effect.runSync(
                Ref.update(sessions, (map) => {
                  const newMap = new Map(map);
                  const s = newMap.get(msg.sessionId);
                  if (s) {
                    newMap.set(msg.sessionId, { ...s, status: 'ended' });
                  }
                  return newMap;
                })
              );

              ptyHandles.delete(msg.sessionId);
              console.log(
                `[daemon] PTY exited for browser-resumed session ${msg.sessionId} (exit ${exitCode})`
              );
            });

            console.log(
              `[daemon] PTY resumed via browser for session ${msg.sessionId} (pid ${handle.pid}, claude session ${msg.claudeSessionId})`
            );
          })
          .catch((err) => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            Effect.runSync(
              wsClient.send({
                type: 'session:spawn-failed',
                sessionId: msg.sessionId,
                error: errorMsg,
                timestamp: Date.now(),
              })
            );
            console.log(`[daemon] Browser resume failed for session ${msg.sessionId}: ${errorMsg}`);
          });
        break;
      }
      case 'session:delete': {
        store.deleteSessionById(msg.sessionId);
        Effect.runSync(
          Ref.update(sessions, (map) => {
            const newMap = new Map(map);
            newMap.delete(msg.sessionId);
            return newMap;
          })
        );
        console.log(`[daemon] Session ${msg.sessionId} deleted from SQLite`);
        break;
      }
      case 'session:clear-ended': {
        store.deleteEndedSessions();
        Effect.runSync(
          Ref.update(sessions, (map) => {
            const newMap = new Map(map);
            for (const [id, s] of newMap) {
              if (s.status === 'ended' || s.status === 'error') {
                newMap.delete(id);
              }
            }
            return newMap;
          })
        );
        console.log('[daemon] Cleared all ended sessions from SQLite');
        break;
      }
    }
  });

  yield* wsClient.connect(config.TMONIER_API_URL, token);
  console.log('[daemon] Backend WebSocket connecting...');

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

            // Relay to backend
            yield* wsClient.send({
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
            store.upsertSession(session, 'interactive');
            store.updateClaudeSessionId(msg.sessionId, msg.sessionId);
            sessionConnections.set(msg.sessionId, conn.id);
            connSessions.set(conn.id, msg.sessionId);

            // Spawn PTY in daemon — daemon owns it
            const handleResult = yield* Effect.result(
              spawnClaudeInteractive(msg.cwd, msg.cols, msg.rows - 1, {
                claudeSessionId: msg.sessionId,
              })
            );

            if (handleResult._tag === 'Failure') {
              const err = handleResult.failure;
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

            const handle = handleResult.success;

            const entry: PtyEntry = {
              handle,
              cliConnId: conn.id,
              cliDimensions: { cols: msg.cols, rows: msg.rows - 1 },
              browserDimensions: null,
              browserConnected: false,
            };
            ptyHandles.set(msg.sessionId, entry);

            // CRITICAL ORDER: notify CLI + API BEFORE registering onOutput.
            // onOutput() drains buffered PTY data synchronously.
            // If we drain before session:started reaches the API, the TerminalRelay
            // doesn't exist yet and all initial output is silently dropped.
            // Similarly, the CLI must have its handler ready before pty-output arrives.

            // 1. Confirm spawn to CLI (so CLI can set up its onMessage handler)
            conn.send(
              JSON.stringify({
                type: 'session:spawned',
                sessionId: msg.sessionId,
                pid: handle.pid,
              })
            );

            // 2. Notify backend (creates TerminalRelay in API)
            yield* wsClient.send({
              type: 'session:started',
              sessionId: msg.sessionId,
              agentType: msg.agentType,
              mode: 'interactive',
              cwd: msg.cwd,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
              timestamp: Date.now(),
            });

            yield* wsClient.send({
              type: 'session:claude-id-detected',
              sessionId: msg.sessionId,
              claudeSessionId: msg.sessionId,
              timestamp: Date.now(),
            });

            // 3. NOW register output handler — drains buffered PTY data
            handle.onOutput((data: Uint8Array) => {
              const base64 = Buffer.from(data).toString('base64');
              const ts = Date.now();
              store.appendTerminalChunk(msg.sessionId, base64, ts);

              // Send to CLI if connected
              if (entry.cliConnId) {
                Effect.runSync(
                  ipcServer.sendTo(
                    entry.cliConnId,
                    JSON.stringify({
                      type: 'session:pty-output',
                      sessionId: msg.sessionId,
                      data: base64,
                    })
                  )
                );
              }

              // Send to backend (for browser)
              Effect.runSync(
                wsClient.send({
                  type: 'terminal:output',
                  sessionId: msg.sessionId,
                  data: base64,
                  timestamp: ts,
                })
              );
            });

            // 4. Monitor for PTY exit
            handle.wait().then((exitCode: number) => {
              const resumable = store.markSessionEnded(msg.sessionId, 'ended', exitCode);

              if (entry.cliConnId) {
                Effect.runSync(
                  ipcServer.sendTo(
                    entry.cliConnId,
                    JSON.stringify({
                      type: 'session:pty-exited',
                      sessionId: msg.sessionId,
                      exitCode,
                    })
                  )
                );
              }

              Effect.runSync(
                wsClient.send({
                  type: 'session:ended',
                  sessionId: msg.sessionId,
                  exitCode,
                  resumable,
                  timestamp: Date.now(),
                })
              );

              Effect.runSync(
                Ref.update(sessions, (map) => {
                  const newMap = new Map(map);
                  const s = newMap.get(msg.sessionId);
                  if (s) {
                    newMap.set(msg.sessionId, { ...s, status: 'ended' });
                  }
                  return newMap;
                })
              );

              ptyHandles.delete(msg.sessionId);
              console.log(`[daemon] PTY exited for session ${msg.sessionId} (exit ${exitCode})`);
            });

            console.log(
              `[daemon] PTY spawned for session ${msg.sessionId} (pid ${handle.pid}, ${msg.cols}x${msg.rows})`
            );

            break;
          }
          case 'session:stdin': {
            const entry = ptyHandles.get(msg.sessionId);
            if (entry) {
              const bytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              entry.handle.write(bytes);
              stripAnsiAndBuffer(
                inputLineBuffers,
                msg.sessionId,
                msg.data,
                'cli',
                (text, source, timestamp) => {
                  store.appendInputEntry(msg.sessionId, text, source, timestamp);
                  Effect.runSync(
                    wsClient.send({
                      type: 'terminal:input-echo',
                      sessionId: msg.sessionId,
                      text,
                      source,
                      timestamp,
                    })
                  );
                }
              );
            }
            break;
          }
          case 'session:cli-resize': {
            const entry = ptyHandles.get(msg.sessionId);
            if (entry) {
              entry.cliDimensions = { cols: msg.cols, rows: msg.rows - 1 };
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
              entry.cliConnId = null;
              console.log(`[daemon] CLI detached from session ${msg.sessionId}, PTY kept alive`);
            }
            break;
          }
          case 'session:attach': {
            const entry = ptyHandles.get(msg.sessionId);
            if (entry) {
              entry.cliConnId = conn.id;
              entry.cliDimensions = { cols: msg.cols, rows: msg.rows };
              sessionConnections.set(msg.sessionId, conn.id);
              connSessions.set(conn.id, msg.sessionId);
              applyResizePriority(msg.sessionId);

              conn.send(
                JSON.stringify({
                  type: 'session:spawned',
                  sessionId: msg.sessionId,
                  pid: entry.handle.pid,
                })
              );

              // Replay recent terminal history so the CLI sees the current TUI state
              const chunks = store.getTerminalChunks(msg.sessionId, 200);
              for (const chunk of chunks) {
                conn.send(
                  JSON.stringify({
                    type: 'session:pty-output',
                    sessionId: msg.sessionId,
                    data: chunk.data,
                  })
                );
              }

              // Force a resize to make the PTY application redraw its TUI.
              // Use priority dimensions (browser wins if connected) to avoid
              // overriding the browser's viewport with the CLI's dimensions.
              if (entry.browserConnected && entry.browserDimensions) {
                entry.handle.resize(entry.browserDimensions.cols, entry.browserDimensions.rows);
              } else {
                entry.handle.resize(msg.cols, msg.rows - 1);
              }

              console.log(
                `[daemon] CLI attached to session ${msg.sessionId} (replayed ${chunks.length} chunks)`
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
            // Relay to backend
            yield* wsClient.send({
              type: 'session:output',
              sessionId: msg.sessionId,
              data: msg.data,
              chunkType: msg.chunkType,
              timestamp: msg.timestamp,
            });
            break;
          }
          case 'session:done': {
            const resumable = store.markSessionEnded(msg.sessionId, 'ended', msg.exitCode);
            yield* Ref.update(sessions, (map) => {
              const newMap = new Map(map);
              const session = newMap.get(msg.sessionId);
              if (session) {
                newMap.set(msg.sessionId, { ...session, status: 'ended' });
              }
              return newMap;
            });

            // Relay to backend
            yield* wsClient.send({
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
            store.markSessionEnded(msg.sessionId, 'error', -1);
            yield* Ref.update(sessions, (map) => {
              const newMap = new Map(map);
              const session = newMap.get(msg.sessionId);
              if (session) {
                newMap.set(msg.sessionId, { ...session, status: 'error' });
              }
              return newMap;
            });

            yield* wsClient.send({
              type: 'session:error',
              sessionId: msg.sessionId,
              error: msg.error,
              timestamp: msg.timestamp,
            });

            console.log(`[daemon] Session error: ${msg.sessionId}: ${msg.error}`);
            break;
          }
          case 'session:terminal-output': {
            // Persist + relay terminal output to backend
            store.appendTerminalChunk(msg.sessionId, msg.data, msg.timestamp);
            console.log(
              `[daemon] terminal-output: sessionId=${msg.sessionId} bytes=${msg.data.length}`
            );
            yield* wsClient.send({
              type: 'terminal:output',
              sessionId: msg.sessionId,
              data: msg.data,
              timestamp: msg.timestamp,
            });
            break;
          }
          case 'session:resume': {
            const session: AgentSession = {
              id: msg.sessionId,
              agentType: 'claude',
              cwd: msg.cwd,
              gitBranch: msg.gitBranch,
              gitRemoteUrl: msg.gitRemoteUrl,
              repoName: msg.repoName,
              startedAt: Date.now(),
              status: 'active',
            };

            yield* Ref.update(sessions, (map) => new Map([...map, [msg.sessionId, session]]));
            store.upsertSession(session, 'interactive');
            sessionConnections.set(msg.sessionId, conn.id);
            connSessions.set(conn.id, msg.sessionId);

            const handleResult = yield* Effect.result(
              spawnClaudeInteractive(msg.cwd, msg.cols, msg.rows, {
                resume: true,
                claudeSessionId: msg.claudeSessionId,
              })
            );

            if (handleResult._tag === 'Failure') {
              const err = handleResult.failure;
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

            const handle = handleResult.success;

            const entry: PtyEntry = {
              handle,
              cliConnId: conn.id,
              cliDimensions: { cols: msg.cols, rows: msg.rows - 1 },
              browserDimensions: null,
              browserConnected: false,
            };
            ptyHandles.set(msg.sessionId, entry);

            conn.send(
              JSON.stringify({
                type: 'session:spawned',
                sessionId: msg.sessionId,
                pid: handle.pid,
              })
            );

            yield* wsClient.send({
              type: 'session:started',
              sessionId: msg.sessionId,
              agentType: 'claude',
              mode: 'interactive',
              cwd: msg.cwd,
              gitBranch: msg.gitBranch,
              repoName: msg.repoName,
              timestamp: Date.now(),
            });

            yield* wsClient.send({
              type: 'session:claude-id-detected',
              sessionId: msg.sessionId,
              claudeSessionId: msg.claudeSessionId,
              timestamp: Date.now(),
            });

            handle.onOutput((data: Uint8Array) => {
              const base64 = Buffer.from(data).toString('base64');
              const ts = Date.now();
              store.appendTerminalChunk(msg.sessionId, base64, ts);

              if (entry.cliConnId) {
                Effect.runSync(
                  ipcServer.sendTo(
                    entry.cliConnId,
                    JSON.stringify({
                      type: 'session:pty-output',
                      sessionId: msg.sessionId,
                      data: base64,
                    })
                  )
                );
              }

              Effect.runSync(
                wsClient.send({
                  type: 'terminal:output',
                  sessionId: msg.sessionId,
                  data: base64,
                  timestamp: ts,
                })
              );
            });

            handle.wait().then((exitCode: number) => {
              const resumable = store.markSessionEnded(msg.sessionId, 'ended', exitCode);

              if (entry.cliConnId) {
                Effect.runSync(
                  ipcServer.sendTo(
                    entry.cliConnId,
                    JSON.stringify({
                      type: 'session:pty-exited',
                      sessionId: msg.sessionId,
                      exitCode,
                    })
                  )
                );
              }

              Effect.runSync(
                wsClient.send({
                  type: 'session:ended',
                  sessionId: msg.sessionId,
                  exitCode,
                  resumable,
                  timestamp: Date.now(),
                })
              );

              Effect.runSync(
                Ref.update(sessions, (map) => {
                  const newMap = new Map(map);
                  const s = newMap.get(msg.sessionId);
                  if (s) {
                    newMap.set(msg.sessionId, { ...s, status: 'ended' });
                  }
                  return newMap;
                })
              );

              ptyHandles.delete(msg.sessionId);
              console.log(
                `[daemon] PTY exited for resumed session ${msg.sessionId} (exit ${exitCode})`
              );
            });

            console.log(
              `[daemon] PTY resumed for session ${msg.sessionId} (pid ${handle.pid}, claude session ${msg.claudeSessionId})`
            );
            break;
          }
          case 'session:claude-id': {
            store.updateClaudeSessionId(msg.sessionId, msg.claudeSessionId);

            yield* wsClient.send({
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
            const resumable = store.markSessionEnded(msg.sessionId, 'ended', 0);
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

            yield* wsClient.send({
              type: 'session:ended',
              sessionId: msg.sessionId,
              exitCode: 0,
              resumable,
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
            // Interactive session with daemon-owned PTY: just mark CLI as detached, keep PTY alive
            entry.cliConnId = null;
            connSessions.delete(connId);
            sessionConnections.delete(sessionId);
            console.log(`[daemon] CLI connection lost for session ${sessionId}, PTY kept alive`);
          } else {
            // Non-interactive session: clean up fully
            store.markSessionEnded(sessionId, 'ended', -1);
            yield* Ref.update(sessions, (map) => {
              const newMap = new Map(map);
              newMap.delete(sessionId);
              return newMap;
            });
            sessionConnections.delete(sessionId);
            connSessions.delete(connId);

            yield* wsClient.send({
              type: 'session:ended',
              sessionId,
              exitCode: -1,
              resumable: false,
              timestamp: Date.now(),
            });

            console.log(`[daemon] Connection lost for session: ${sessionId}`);
          }
        }
      })
  );

  console.log(`[daemon] IPC server listening on ${SOCKET_PATH}`);

  // Dedicated stdin socket — receives only stdin data, no write traffic back.
  // This avoids a Bun bug where heavy server→client writes on a Unix socket
  // prevent the server's `data` handler from firing for client→server messages.
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
              // Strip escape sequences and buffer lines for input history
              stripAnsiAndBuffer(
                inputLineBuffers,
                sid,
                parsed.data,
                'cli',
                (text, source, timestamp) => {
                  store.appendInputEntry(sid, text, source, timestamp);
                  Effect.runSync(
                    wsClient.send({
                      type: 'terminal:input-echo',
                      sessionId: sid,
                      text,
                      source,
                      timestamp,
                    })
                  );
                }
              );
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
