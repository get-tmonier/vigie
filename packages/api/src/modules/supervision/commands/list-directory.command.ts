import type { FsListDirRequest, FsListDirResponse } from '@tmonier/shared';
import { Effect } from 'effect';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { DaemonDisconnectedError, type DaemonNotFoundError } from '../ports/errors';

export const listDirectory = (
  daemonId: string,
  path: string,
  pendingFsRequests: Map<
    string,
    { resolve: (response: FsListDirResponse) => void; timer: ReturnType<typeof setTimeout> }
  >
): Effect.Effect<
  FsListDirResponse,
  DaemonNotFoundError | DaemonDisconnectedError,
  DaemonWriteRepository
> =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonWriteRepository);
    const ws = yield* repo.getWs(daemonId);
    if (ws.readyState !== WebSocket.OPEN) {
      return yield* Effect.fail(new DaemonDisconnectedError({ id: daemonId }));
    }

    const requestId = crypto.randomUUID();
    const message: FsListDirRequest = { type: 'fs:list-dir', requestId, path };

    const response = yield* Effect.promise<FsListDirResponse>(
      () =>
        new Promise<FsListDirResponse>((resolve) => {
          const timer = setTimeout(() => {
            pendingFsRequests.delete(requestId);
            resolve({
              type: 'fs:list-dir-response',
              requestId,
              entries: [],
              error: 'Request timed out',
            });
          }, 5000);

          pendingFsRequests.set(requestId, { resolve, timer });
          ws.send(JSON.stringify(message));
        })
    );

    return response;
  });
