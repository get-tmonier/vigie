import { unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer } from 'effect';
import { CliSender } from '#modules/agent-session/application/ports/out/cli-sender.port';
import { AgentSession } from '#modules/agent-session/dependencies';
import { IpcServer } from '#modules/daemon/application/ports/out/ipc-server.port';
import { createRunDaemon } from '#modules/daemon/application/use-cases/run-daemon.use-case';
import { UnixSocketServerLive } from '#modules/daemon/infrastructure/adapters/out/unix-socket-server.adapter';
import { createRoutesLayer } from '#modules/daemon/infrastructure/server';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

export function cleanup(): void {
  for (const file of ['daemon.pid', 'daemon.sock', 'daemon-stdin.sock', 'port']) {
    try {
      unlinkSync(join(_HOME, file));
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

export const runDaemon = Effect.gen(function* () {
  const agentSession = yield* AgentSession;
  const appRoutes = createRoutesLayer({ appRoutes: agentSession.routes });
  const runner = createRunDaemon({
    startupOps: agentSession.startupOps,
    spawnSession: agentSession.spawnSession,
    sessionLifecycle: agentSession.sessionLifecycle,
    terminalConnection: agentSession.terminalConnection,
    appRoutes,
    cleanup,
  });
  return yield* runner;
});
