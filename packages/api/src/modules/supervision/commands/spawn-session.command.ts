import type { SessionSpawnRequest } from '@tmonier/shared';
import { Effect } from 'effect';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { DaemonDisconnectedError, type DaemonNotFoundError } from '../ports/errors';

export const spawnSession = (
  daemonId: string,
  agentType: 'claude' | 'opencode' | 'generic',
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
    const sessionId = crypto.randomUUID();
    const message: SessionSpawnRequest = {
      type: 'session:spawn-request',
      sessionId,
      agentType,
      cwd,
      cols,
      rows,
    };
    ws.send(JSON.stringify(message));
    return { sessionId };
  });
