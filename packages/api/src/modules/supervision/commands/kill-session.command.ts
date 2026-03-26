import type { SessionKill } from '@vigie/shared';
import { Effect } from 'effect';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { DaemonDisconnectedError, type DaemonNotFoundError } from '../ports/errors';

export const killSession = (
  daemonId: string,
  sessionId: string
): Effect.Effect<void, DaemonNotFoundError | DaemonDisconnectedError, DaemonWriteRepository> =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonWriteRepository);
    const ws = yield* repo.getWs(daemonId);
    if (ws.readyState !== WebSocket.OPEN) {
      return yield* Effect.fail(new DaemonDisconnectedError({ id: daemonId }));
    }
    const message: SessionKill = {
      type: 'session:kill',
      sessionId,
    };
    ws.send(JSON.stringify(message));
  });
