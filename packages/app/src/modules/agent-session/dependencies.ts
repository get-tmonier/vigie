import { Layer } from 'effect';
import { AgentRegistryLive } from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
import { BunPtySpawnerLive } from '#modules/agent-session/infrastructure/adapters/out/bun-pty-spawner';
import {
  AppEventPublisherTag,
  EventPublisherLive,
} from '#modules/agent-session/infrastructure/adapters/out/event-publisher.adapter';
import { FsResumabilityCheckerLive } from '#modules/agent-session/infrastructure/adapters/out/fs-resumability-checker';
import { SqliteSessionRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
import { SqliteTerminalRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
import {
  TerminalSubscribers,
  TerminalSubscribersLive,
} from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';

export { AgentRegistry } from '#modules/agent-session/application/ports/out/agent-adapter.port';
export { EventPublisher } from '#modules/agent-session/application/ports/out/event-publisher.port';
export { PtySpawner } from '#modules/agent-session/application/ports/out/pty-spawner.port';
export { ResumabilityChecker } from '#modules/agent-session/application/ports/out/resumability-checker.port';
export { SessionRepository } from '#modules/agent-session/application/ports/out/session-repository.port';
export { TerminalRepository } from '#modules/agent-session/application/ports/out/terminal-repository.port';
export { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
export { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
export { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
export { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
export { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
export { createTerminalConnectionUseCase } from '#modules/agent-session/application/use-cases/terminal-connection.use-case';
export { createSessionRoutes } from '#modules/agent-session/infrastructure/adapters/in/session.routes';
export { createTerminalRoutes } from '#modules/agent-session/infrastructure/adapters/in/terminal.routes';
export { createPtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';
export { AppEventPublisherTag, TerminalSubscribers };

export const AgentSessionLayer = Layer.mergeAll(
  EventPublisherLive,
  BunPtySpawnerLive,
  FsResumabilityCheckerLive,
  AgentRegistryLive,
  TerminalSubscribersLive,
  SqliteSessionRepositoryLive,
  SqliteTerminalRepositoryLive
);
