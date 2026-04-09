import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer } from 'effect';
import { AgentSession, AgentSessionLive } from '#modules/agent-session/dependencies';
import { createSessionApiRoutes } from '#modules/agent-session/infrastructure/adapters/in/session.api-routes';
import { createTerminalRoutes } from '#modules/agent-session/infrastructure/adapters/in/terminal.routes';
import { makeDatabaseLayer } from '#shared/db/database';
import { BrowserEventBus } from '#shell/application/ports/out/browser-event-bus.port';
import { createRunDaemon } from '#shell/application/run-daemon';
import { BrowserEventBusLive, cleanup, DaemonLive } from '#shell/dependencies';
import { createDashboardRoutes } from '#shell/infrastructure/adapters/in/dashboard.routes';
import { createEventsRoutes } from '#shell/infrastructure/adapters/in/events.routes';
import { createRoutesLayer } from '#shell/infrastructure/server';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

const DatabaseLive = makeDatabaseLayer(`${_HOME}/data.db`);

export const AppLive = AgentSessionLive.pipe(
  Layer.provide(DaemonLive),
  Layer.provide(DatabaseLive),
  Layer.provide(BrowserEventBusLive)
);

export const runDaemon = Effect.gen(function* () {
  const agentSession = yield* AgentSession;
  const browserEventBus = yield* BrowserEventBus;

  const apiRoutes = createSessionApiRoutes({
    spawnSession: agentSession.spawnSession,
    sessionCleanup: agentSession.sessionCleanup,
    sessionQueries: agentSession.sessionQueries,
    terminalConnection: agentSession.terminalConnection,
  });

  const dashboardRoutes = createDashboardRoutes({
    spawnSession: agentSession.spawnSession,
    sessionCleanup: agentSession.sessionCleanup,
    sessionQueries: agentSession.sessionQueries,
    terminalConnection: agentSession.terminalConnection,
  });

  const eventsRoutes = createEventsRoutes({
    sessionQueries: agentSession.sessionQueries,
    browserEventBus,
  });

  const terminalRoutes = createTerminalRoutes({
    sessionQueries: agentSession.sessionQueries,
    terminalConnection: agentSession.terminalConnection,
    terminalSubs: agentSession.terminalSubs,
  });

  const appRoutes = createRoutesLayer({
    appRoutes: [...apiRoutes, ...dashboardRoutes, ...eventsRoutes, ...terminalRoutes],
  });

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
