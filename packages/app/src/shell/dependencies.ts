import { unlinkSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { CliSender } from '#shared/kernel/contracts/cli-sender';
import { IpcServer } from '#shell/application/ports/out/ipc-server.port';
import { UnixSocketServerLive } from '#shell/infrastructure/adapters/out/unix-socket-server.adapter';
import type { DaemonConfigShape } from '#shell/infrastructure/daemon-config';

export function cleanup(config: DaemonConfigShape): void {
  for (const filePath of [
    config.pidFile,
    config.socketPath,
    config.stdinSocketPath,
    config.portFile,
  ]) {
    try {
      unlinkSync(filePath);
    } catch {}
  }
}

const CliSenderLive = Layer.effect(CliSender)(
  Effect.gen(function* () {
    const ipcServer = yield* IpcServer;
    return {
      send: (connId: string, msg: string): void => {
        Effect.runFork(ipcServer.sendTo(connId, msg));
      },
    };
  })
);

export const DaemonLive = Layer.mergeAll(UnixSocketServerLive, CliSenderLive);
