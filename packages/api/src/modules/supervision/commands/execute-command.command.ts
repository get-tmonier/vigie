import type { CommandRequest } from '@vigie/shared';
import { Effect } from 'effect';
import { createCommand } from '../domain/command';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { DaemonDisconnectedError, type DaemonNotFoundError } from '../ports/errors';

export const executeCommand = (
  daemonId: string,
  command: string,
  cwd?: string
): Effect.Effect<
  { commandId: string },
  DaemonNotFoundError | DaemonDisconnectedError,
  DaemonWriteRepository
> =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonWriteRepository);
    const cmd = createCommand(daemonId, command, cwd);
    const ws = yield* repo.getWs(daemonId);
    if (ws.readyState !== WebSocket.OPEN) {
      return yield* Effect.fail(new DaemonDisconnectedError({ id: daemonId }));
    }
    const message: CommandRequest = {
      type: 'command:request',
      id: cmd.id,
      command: cmd.command,
      cwd: cmd.cwd,
    };
    ws.send(JSON.stringify(message));
    return { commandId: cmd.id };
  });
