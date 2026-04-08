import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer } from 'effect';
import { AgentSession, AgentSessionLive } from '#modules/agent-session/dependencies';
import { makeDatabaseLayer } from '#shared/db/database';
import { createRunDaemon } from '#shell/application/run-daemon';
import { cleanup, DaemonLive } from '#shell/dependencies';
import { createRoutesLayer } from '#shell/infrastructure/server';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

const DatabaseLive = makeDatabaseLayer(`${_HOME}/data.db`);

export const AppLive = AgentSessionLive.pipe(
  Layer.provide(DaemonLive),
  Layer.provide(DatabaseLive)
);

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
