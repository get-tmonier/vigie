import { Effect, Layer, ServiceMap } from 'effect';
import type * as Cause from 'effect/Cause';
import type * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import type * as Socket from 'effect/unstable/socket/Socket';
import { AgentRegistry } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import { EventFeed } from '#modules/agent-session/application/ports/out/event-feed.port';
import { EventPublisher } from '#modules/agent-session/application/ports/out/event-publisher.port';
import { PtySpawner } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import { ResumabilityChecker } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import { SessionRepository } from '#modules/agent-session/application/ports/out/session-repository.port';
import { TerminalRepository } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import { createTerminalConnectionUseCase } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { createSessionRoutes } from '#modules/agent-session/infrastructure/adapters/in/session.routes';
import { createTerminalRoutes } from '#modules/agent-session/infrastructure/adapters/in/terminal.routes';
import { AgentRegistryLive } from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
import { BunPtySpawnerLive } from '#modules/agent-session/infrastructure/adapters/out/bun-pty-spawner';
import { EventFeedLive } from '#modules/agent-session/infrastructure/adapters/out/event-feed.adapter';
import { EventPublisherLive } from '#modules/agent-session/infrastructure/adapters/out/event-publisher.adapter';
import { FsResumabilityCheckerLive } from '#modules/agent-session/infrastructure/adapters/out/fs-resumability-checker';
import { SqliteSessionRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
import { SqliteTerminalRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
import {
  TerminalSubscribers,
  TerminalSubscribersLive,
} from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import { createPtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';
import { CliSender } from '#shared/kernel/contracts/cli-sender';

type RouteError = HttpServerError.HttpServerError | Socket.SocketError | Cause.UnknownError;

export interface AgentSessionServices {
  spawnSession: ReturnType<typeof createSpawnSessionUseCase>;
  sessionLifecycle: ReturnType<typeof createSessionLifecycleUseCase>;
  sessionCleanup: ReturnType<typeof createSessionCleanupUseCase>;
  sessionQueries: ReturnType<typeof createSessionQueriesUseCase>;
  checkResumability: ReturnType<typeof createCheckResumabilityUseCase>;
  terminalConnection: ReturnType<typeof createTerminalConnectionUseCase>;
  startupOps: {
    cleanupOrphanedSessions: () => void;
    pruneOldSessions: () => void;
    checkResumableForAll: () => void;
    checkResumableForActive: () => void;
  };
  routes: HttpRouter.Route<RouteError, never>[];
}

export class AgentSession extends ServiceMap.Service<AgentSession, AgentSessionServices>()(
  '@vigie/AgentSession'
) {}

const AgentSessionInfraLive = Layer.mergeAll(
  EventFeedLive,
  EventPublisherLive,
  BunPtySpawnerLive,
  FsResumabilityCheckerLive,
  AgentRegistryLive,
  TerminalSubscribersLive,
  SqliteSessionRepositoryLive,
  SqliteTerminalRepositoryLive
);

export const AgentSessionLive = Layer.effect(AgentSession)(
  Effect.gen(function* () {
    const sessionRepo = yield* SessionRepository;
    const terminalRepo = yield* TerminalRepository;
    const ptySpawner = yield* PtySpawner;
    const agentRegistry = yield* AgentRegistry;
    const resumabilityChecker = yield* ResumabilityChecker;
    const eventPublisher = yield* EventPublisher;
    const terminalSubs = yield* TerminalSubscribers;
    const eventFeed = yield* EventFeed;
    const cliSender = yield* CliSender;

    const registry = createPtyRegistry();

    const terminalConnection = createTerminalConnectionUseCase({
      sessionRepo,
      terminalRepo,
      eventPublisher,
      terminalSubs,
      agentRegistry,
      resumabilityChecker,
      registry,
      sendToCliClient: (connId: string, msg: string) => cliSender.send(connId, msg),
    });

    const spawnSession = createSpawnSessionUseCase({
      sessionRepo,
      ptySpawner,
      agentRegistry,
      eventPublisher,
      registry,
      setupPtyLifecycle: terminalConnection.setupPtyLifecycle,
    });

    const sessionLifecycle = createSessionLifecycleUseCase({
      sessionRepo,
      resumabilityChecker,
      agentRegistry,
      eventPublisher,
      registry,
    });

    const sessionCleanup = createSessionCleanupUseCase({
      sessionRepo,
      eventPublisher,
    });

    const checkResumability = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker,
      eventPublisher,
    });

    const sessionQueries = createSessionQueriesUseCase({
      sessionRepo,
      terminalRepo,
    });

    const startupOps = {
      cleanupOrphanedSessions: () => sessionRepo.markOrphanedEnded(),
      pruneOldSessions: () => sessionRepo.pruneOld(),
      checkResumableForAll: () => checkResumability.checkResumableForAll(),
      checkResumableForActive: () => checkResumability.checkResumableForActive(),
    };

    const routes: HttpRouter.Route<RouteError, never>[] = [
      ...createSessionRoutes({
        spawnSession,
        sessionCleanup,
        sessionQueries,
        terminalConnection,
        eventFeed,
      }),
      ...createTerminalRoutes({
        sessionQueries,
        terminalConnection,
        terminalSubs,
      }),
    ];

    return {
      spawnSession,
      sessionLifecycle,
      sessionCleanup,
      sessionQueries,
      checkResumability,
      terminalConnection,
      startupOps,
      routes,
    };
  })
).pipe(Layer.provide(AgentSessionInfraLive));
