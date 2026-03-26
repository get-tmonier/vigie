import type { SessionKill } from '@vigie/shared';
import { Effect } from 'effect';
import { sessionStore } from '../adapters/secondary/shared-state';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { DaemonDisconnectedError, type DaemonNotFoundError } from '../ports/errors';

export const killAllSessions = (
  daemonId: string
): Effect.Effect<
  { killedCount: number },
  DaemonNotFoundError | DaemonDisconnectedError,
  DaemonWriteRepository
> =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonWriteRepository);
    const ws = yield* repo.getWs(daemonId);
    if (ws.readyState !== WebSocket.OPEN) {
      return yield* Effect.fail(new DaemonDisconnectedError({ id: daemonId }));
    }

    let killedCount = 0;
    for (const [id, session] of sessionStore) {
      if (session.daemonId === daemonId && session.status === 'active') {
        const message: SessionKill = {
          type: 'session:kill',
          sessionId: id,
        };
        ws.send(JSON.stringify(message));
        killedCount++;
      }
    }

    return { killedCount };
  });
