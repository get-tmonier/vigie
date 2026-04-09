import { Effect } from 'effect';
import * as Schema from 'effect/Schema';
import { expandPath } from '#shared/lib/path';
import type { IpcConnection } from '#shell/application/ports/out/ipc-server.port';
import type { SessionToDaemon } from '#shell/protocols/ipc';

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

import type { AgentType } from '#shared/kernel/session/agent-type';
import type { SessionId } from '#shared/kernel/session/session-id';

interface IpcRouterDeps {
  spawnSession: {
    register(props: {
      sessionId: SessionId;
      agentType: AgentType;
      cwd: string;
      mode?: 'prompt' | 'interactive';
      gitBranch?: string;
      gitRemoteUrl?: string;
      repoName?: string;
      connId: string;
    }): void;
    spawnInteractive(props: {
      sessionId?: SessionId;
      agentType: AgentType;
      cwd: string;
      cols: number;
      rows: number;
      connId?: string;
      agentSessionId?: string;
      resume?: boolean;
      gitBranch?: string;
      repoName?: string;
    }): Effect.Effect<{ sessionId: string; pid: number }, Error>;
    resume(
      sessionId: SessionId,
      opts: { cols: number; rows: number; connId?: string; gitBranch?: string; repoName?: string }
    ): Effect.Effect<{ sessionId: string; pid: number }, Error>;
  };
  sessionLifecycle: {
    markEnded(sessionId: SessionId, exitCode: number): void;
    markError(sessionId: SessionId, error: string): void;
    setAgentSessionId(sessionId: SessionId, agentSessionId: string): void;
    deregister(sessionId: SessionId): void;
  };
  ptyManager: {
    writeInput(sessionId: SessionId, data: string, source: 'cli' | 'browser'): void;
    updateCliResize(sessionId: SessionId, connId: string, cols: number, rows: number): void;
    handleDisconnect(connId: string): void;
    detach(sessionId: SessionId, connId: string): void;
    attach(
      sessionId: SessionId,
      connId: string,
      dims: { cols: number; rows: number }
    ): { chunks: Array<{ data: string }>; pid: number } | null;
    clearConnection(connId: string): void;
  };
}

export function createIpcRouter(
  deps: IpcRouterDeps
): (conn: IpcConnection, msg: SessionToDaemon) => Effect.Effect<void> {
  const { spawnSession, sessionLifecycle, ptyManager } = deps;

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
          ptyManager.writeInput(msg.sessionId, msg.data, 'cli');
          break;
        }
        case 'session:cli-resize': {
          ptyManager.updateCliResize(msg.sessionId, conn.id, msg.cols, msg.rows);
          yield* Effect.logInfo(
            `[daemon] cli-resize sessionId=${msg.sessionId} cols=${msg.cols} rows=${msg.rows}`
          );
          break;
        }
        case 'session:detach': {
          ptyManager.detach(msg.sessionId, conn.id);
          break;
        }
        case 'session:attach': {
          const result = ptyManager.attach(msg.sessionId, conn.id, {
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
                encodeJson({
                  type: 'session:pty-output',
                  sessionId: msg.sessionId,
                  data: chunk.data,
                })
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
          ptyManager.clearConnection(conn.id);
          break;
        }
      }
    });
}
