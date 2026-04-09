import { unlinkSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { CliChannel } from '#modules/agent-session/application/ports/out/cli-channel.port';
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

const CliChannelLive = Layer.effect(CliChannel)(
  Effect.gen(function* () {
    const ipcServer = yield* IpcServer;
    return {
      send: (connId: string, msg: string): void => {
        Effect.runFork(ipcServer.sendTo(connId, msg));
      },
    };
  })
);

export const DaemonLive = Layer.merge(
  UnixSocketServerLive,
  CliChannelLive.pipe(Layer.provide(UnixSocketServerLive))
);

export { BrowserEventBusLive } from '#shell/infrastructure/adapters/out/browser-event-bus.adapter';
