import type { SessionResumeRequest } from '@tmonier/shared';
import { Effect } from 'effect';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { DaemonDisconnectedError, type DaemonNotFoundError } from '../ports/errors';

export const resumeSession = (
  daemonId: string,
  sessionId: string,
  claudeSessionId: string,
  cwd: string,
  cols: number,
  rows: number
): Effect.Effect<
  { sessionId: string },
  DaemonNotFoundError | DaemonDisconnectedError,
  DaemonWriteRepository
> =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonWriteRepository);
    const ws = yield* repo.getWs(daemonId);
    if (ws.readyState !== WebSocket.OPEN) {
      return yield* Effect.fail(new DaemonDisconnectedError({ id: daemonId }));
    }
    const message: SessionResumeRequest = {
      type: 'session:resume-request',
      sessionId,
      originalSessionId: sessionId,
      claudeSessionId,
      cwd,
      cols,
      rows,
    };
    ws.send(JSON.stringify(message));
    return { sessionId };
  });
