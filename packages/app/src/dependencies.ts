import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Effect, Layer } from 'effect';
import { SessionEventBus } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import { AgentSession, AgentSessionLive } from '#modules/agent-session/dependencies';
import { createHookRoutes } from '#modules/agent-session/infrastructure/adapters/in/hooks.routes';
import { createSessionApiRoutes } from '#modules/agent-session/infrastructure/adapters/in/session.api-routes';
import { createTerminalRoutes } from '#modules/agent-session/infrastructure/adapters/in/terminal.routes';
import { SessionEventBusLive } from '#modules/agent-session/infrastructure/adapters/out/session-event-bus.adapter';
import { createDashboardRoutes } from '#pages/dashboard.page';
import { makeDatabaseLayer } from '#shared/db/database';
import { BrowserEventBus } from '#shell/application/ports/out/browser-event-bus.port';
import { createRunDaemon } from '#shell/application/run-daemon';
import { BrowserEventBusLive, cleanup, DaemonLive } from '#shell/dependencies';
import { createEventsRoutes } from '#shell/infrastructure/adapters/in/events.routes';
import { createRoutesLayer } from '#shell/infrastructure/server';

const _HOME = process.env.VIGIE_HOME ?? join(homedir(), '.vigie');

const DatabaseLive = makeDatabaseLayer(`${_HOME}/data.db`);

const SharedInfraLive = Layer.mergeAll(SessionEventBusLive, DaemonLive, DatabaseLive);

export const AppLive = Layer.mergeAll(
  AgentSessionLive.pipe(Layer.provide(SharedInfraLive)),
  BrowserEventBusLive.pipe(Layer.provide(SharedInfraLive)),
  SharedInfraLive
);

export const runDaemon = Effect.gen(function* () {
  const agentSession = yield* AgentSession;
  const browserEventBus = yield* BrowserEventBus;
  const sessionEventBus = yield* SessionEventBus;

  const apiRoutes = createSessionApiRoutes({
    spawnSession: agentSession.spawnSession,
    spawnStructuredSession: agentSession.spawnStructuredSession,
    sessionCleanup: agentSession.sessionCleanup,
    sessionQueries: agentSession.sessionQueries,
    sessionLifecycle: agentSession.sessionLifecycle,
    ptyManager: agentSession.ptyManager,
    structuredEventStore: agentSession.structuredEventStore,
  });

  const dashboardRoutes = createDashboardRoutes({
    sessionQueries: agentSession.sessionQueries,
  });

  const eventsRoutes = createEventsRoutes({
    sessionQueries: agentSession.sessionQueries,
    browserEventBus,
  });

  const terminalRoutes = createTerminalRoutes({
    sessionQueries: agentSession.sessionQueries,
    ptyManager: agentSession.ptyManager,
    terminalSubs: agentSession.terminalSubs,
  });

  const clientDistCandidates = [
    join(dirname(process.execPath), 'client'),
    resolve(import.meta.dir, '..', 'dist', 'client'),
  ];
  const clientDistPath = clientDistCandidates.find((p) => existsSync(p));

  const hookRoutes = createHookRoutes({
    sessionQueries: agentSession.sessionQueries,
    eventPublisher: sessionEventBus,
    structuredEventStore: agentSession.structuredEventStore,
  });

  const appRoutes = createRoutesLayer({
    appRoutes: [
      ...apiRoutes,
      ...dashboardRoutes,
      ...eventsRoutes,
      ...terminalRoutes,
      ...hookRoutes,
    ],
    clientDistPath,
  });

  const runner = createRunDaemon({
    startupOps: agentSession.startupOps,
    spawnSession: agentSession.spawnSession,
    sessionLifecycle: agentSession.sessionLifecycle,
    ptyManager: agentSession.ptyManager,
    appRoutes,
    cleanup,
  });
  return yield* runner;
});
