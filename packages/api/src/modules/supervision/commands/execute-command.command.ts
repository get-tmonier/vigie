import type { CommandRequest } from '@tmonier/shared';
import { Effect } from 'effect';
import { createCommand } from '../domain/command';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import type { DaemonNotFoundError } from '../ports/errors';

export const executeCommand = (
  daemonId: string,
  command: string,
  cwd?: string
): Effect.Effect<{ commandId: string }, DaemonNotFoundError, DaemonWriteRepository> =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonWriteRepository);
    const cmd = createCommand(daemonId, command, cwd);
    const ws = yield* repo.getWs(daemonId);
    const message: CommandRequest = {
      type: 'command:request',
      id: cmd.id,
      command: cmd.command,
      cwd: cmd.cwd,
    };
    ws.send(JSON.stringify(message));
    return { commandId: cmd.id };
  });
