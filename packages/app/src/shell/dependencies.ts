import { unlinkSync } from 'node:fs';
import { Effect, Layer } from 'effect';
import { SessionSink } from '#modules/agent-session/application/ports/out/session-sink.port';
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

const SessionSinkLive = Layer.effect(SessionSink)(
  Effect.gen(function* () {
    const ipcServer = yield* IpcServer;
    return {
      send: (connId: string, msg: string): void => {
        Effect.runFork(ipcServer.sendTo(connId, msg));
      },
    };
  })
);

export const DaemonLive = Layer.mergeAll(UnixSocketServerLive, SessionSinkLive);
