import { Effect } from 'effect';
import type { SessionCommandShape } from '#modules/daemon/application/ports/in/session-command.port';
import type { IpcConnection } from '#modules/daemon/application/ports/out/ipc-server.port';
import type { SessionToDaemon } from '#shared/kernel/ipc-protocol';
import { SessionId } from '#shared/kernel/session-id';
import { expandPath } from '#shared/lib/path';

export function createIpcRouter(
  svc: SessionCommandShape
): (conn: IpcConnection, msg: SessionToDaemon) => Effect.Effect<void> {
  return (conn, msg) =>
    Effect.gen(function* () {
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
          const spawnResult = yield* Effect.result(
            svc.spawnInteractive({
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
              JSON.stringify({
                type: 'session:spawn-failed',
                sessionId: msg.sessionId,
                error: err instanceof Error ? err.message : String(err),
              })
            );
            break;
          }

          const { sessionId, pid } = spawnResult.success;
          conn.send(
            JSON.stringify({
              type: 'session:spawned',
              sessionId,
              pid,
            })
          );
          break;
        }
        case 'session:stdin': {
          svc.writeInput(msg.sessionId, msg.data, 'cli');
          break;
        }
        case 'session:cli-resize': {
          svc.updateCliResize(msg.sessionId, conn.id, msg.cols, msg.rows);
          yield* Effect.logInfo(
            `[daemon] cli-resize sessionId=${msg.sessionId} cols=${msg.cols} rows=${msg.rows}`
          );
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
            conn.send(
              JSON.stringify({
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
            yield* Effect.logInfo(
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
          break;
        }
        case 'session:done': {
          svc.markEnded(SessionId(msg.sessionId), msg.exitCode);
          yield* Effect.logInfo(`[daemon] Session done: ${msg.sessionId} (exit ${msg.exitCode})`);
          break;
        }
        case 'session:error': {
          svc.markError(SessionId(msg.sessionId), msg.error);
          yield* Effect.logError(`[daemon] Session error: ${msg.sessionId}: ${msg.error}`);
          break;
        }
        case 'session:terminal-output': {
          break;
        }
        case 'session:resume': {
          const resumeResult = yield* Effect.result(
            svc.resume(SessionId(msg.sessionId), {
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
              JSON.stringify({
                type: 'session:spawn-failed',
                sessionId: msg.sessionId,
                error: err instanceof Error ? err.message : String(err),
              })
            );
            break;
          }

          const { sessionId: resumedId, pid: resumedPid } = resumeResult.success;
          conn.send(
            JSON.stringify({
              type: 'session:spawned',
              sessionId: resumedId,
              pid: resumedPid,
            })
          );
          break;
        }
        case 'session:agent-id': {
          svc.setAgentSessionId(SessionId(msg.sessionId), msg.agentSessionId);
          yield* Effect.logInfo(
            `[daemon] Agent session ID detected for ${msg.sessionId}: ${msg.agentSessionId}`
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
