import { Effect, Layer, ServiceMap } from 'effect';
import { AgentRegistry } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import { DomainEventBus } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import { PtySpawner } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import { ResumabilityChecker } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import { SessionRepository } from '#modules/agent-session/application/ports/out/session-repository.port';
import { SessionSink } from '#modules/agent-session/application/ports/out/session-sink.port';
import { TerminalRepository } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import { createTerminalConnectionUseCase } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
import { AgentRegistryLive } from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
import { BunPtySpawnerLive } from '#modules/agent-session/infrastructure/adapters/out/bun-pty-spawner';
import { DomainEventBusLive } from '#modules/agent-session/infrastructure/adapters/out/domain-event-bus.adapter';
import { FsResumabilityCheckerLive } from '#modules/agent-session/infrastructure/adapters/out/fs-resumability-checker';
import { SqliteSessionRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
import { SqliteTerminalRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
import {
  TerminalSubscribers,
  TerminalSubscribersLive,
  type TerminalSubscribersShape,
} from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import { createPtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';

export interface AgentSessionServices {
  spawnSession: ReturnType<typeof createSpawnSessionUseCase>;
  sessionLifecycle: ReturnType<typeof createSessionLifecycleUseCase>;
  sessionCleanup: ReturnType<typeof createSessionCleanupUseCase>;
  sessionQueries: ReturnType<typeof createSessionQueriesUseCase>;
  checkResumability: ReturnType<typeof createCheckResumabilityUseCase>;
  terminalConnection: ReturnType<typeof createTerminalConnectionUseCase>;
  terminalSubs: TerminalSubscribersShape;
  startupOps: {
    cleanupOrphanedSessions: () => void;
    pruneOldSessions: () => void;
    checkResumableForAll: () => void;
    checkResumableForActive: () => void;
  };
}

export class AgentSession extends ServiceMap.Service<AgentSession, AgentSessionServices>()(
  '@vigie/AgentSession'
) {}

const AgentSessionInfraLive = Layer.mergeAll(
  DomainEventBusLive,
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
    const eventPublisher = yield* DomainEventBus;
    const terminalSubs = yield* TerminalSubscribers;
    const sessionSink = yield* SessionSink;

    const registry = createPtyRegistry();

    const terminalConnection = createTerminalConnectionUseCase({
      sessionRepo,
      terminalRepo,
      eventPublisher,
      terminalSubs,
      agentRegistry,
      resumabilityChecker,
      registry,
      sendToCliClient: (connId: string, msg: string) => sessionSink.send(connId, msg),
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

    return {
      spawnSession,
      sessionLifecycle,
      sessionCleanup,
      sessionQueries,
      checkResumability,
      terminalConnection,
      terminalSubs,
      startupOps,
    };
  })
).pipe(Layer.provide(AgentSessionInfraLive));
