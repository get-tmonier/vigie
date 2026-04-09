import { Effect, Layer, ServiceMap } from 'effect';
import { AgentRegistry } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import { ResumabilityChecker } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import { SessionEventBus } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import { SessionLog } from '#modules/agent-session/application/ports/out/session-log.port';
import { SessionSink } from '#modules/agent-session/application/ports/out/session-sink.port';
import { SessionStore } from '#modules/agent-session/application/ports/out/session-store.port';
import { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import { AgentRegistryLive } from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
import { createBunPtySpawnFn } from '#modules/agent-session/infrastructure/adapters/out/bun-pty-spawner';
import { FsResumabilityCheckerLive } from '#modules/agent-session/infrastructure/adapters/out/fs-resumability-checker';
import { SqliteSessionRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
import { SqliteTerminalRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
import {
  TerminalSubscribers,
  TerminalSubscribersLive,
  type TerminalSubscribersShape,
} from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import { createPtyManager } from '#modules/agent-session/infrastructure/pty-manager';
import type { PtyManagerShape } from '#modules/agent-session/infrastructure/pty-manager.types';

export interface AgentSessionServices {
  spawnSession: ReturnType<typeof createSpawnSessionUseCase>;
  sessionLifecycle: ReturnType<typeof createSessionLifecycleUseCase>;
  sessionCleanup: ReturnType<typeof createSessionCleanupUseCase>;
  sessionQueries: ReturnType<typeof createSessionQueriesUseCase>;
  checkResumability: ReturnType<typeof createCheckResumabilityUseCase>;
  ptyManager: PtyManagerShape;
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
  FsResumabilityCheckerLive,
  AgentRegistryLive,
  TerminalSubscribersLive,
  SqliteSessionRepositoryLive,
  SqliteTerminalRepositoryLive
);

export const AgentSessionLive = Layer.effect(AgentSession)(
  Effect.gen(function* () {
    const sessionStore = yield* SessionStore;
    const sessionLog = yield* SessionLog;
    const agentRegistry = yield* AgentRegistry;
    const resumabilityChecker = yield* ResumabilityChecker;
    const eventPublisher = yield* SessionEventBus;
    const terminalSubs = yield* TerminalSubscribers;
    const sessionSink = yield* SessionSink;

    const sessionLifecycle = createSessionLifecycleUseCase({
      sessionRepo: sessionStore,
      resumabilityChecker,
      agentRegistry,
      eventPublisher,
    });

    const ptyManager = createPtyManager({
      spawner: createBunPtySpawnFn(),
      callbacks: {
        onOutput(sessionId, base64, _ts) {
          fireAndForget(terminalSubs.publish(sessionId, base64));
        },
        onProcessExited(sessionId, exitCode) {
          sessionLifecycle.markEnded(sessionId, exitCode);
        },
        onResized(sessionId, cols, rows) {
          fireAndForget(
            eventPublisher.publish({ type: 'terminal:pty-resized', sessionId, cols, rows })
          );
        },
        onInputEcho(sessionId, text, source, timestamp) {
          fireAndForget(
            eventPublisher.publish({
              type: 'terminal:input-echo',
              sessionId,
              text,
              source,
              timestamp,
            })
          );
        },
        sendToCliClient(connId, msg) {
          sessionSink.send(connId, msg);
        },
      },
      terminalRepo: sessionLog,
    });

    const spawnSession = createSpawnSessionUseCase({
      sessionRepo: sessionStore,
      agentRegistry,
      eventPublisher,
      ptyManager,
    });

    const sessionCleanup = createSessionCleanupUseCase({
      sessionRepo: sessionStore,
      eventPublisher,
    });

    const checkResumability = createCheckResumabilityUseCase({
      sessionRepo: sessionStore,
      resumabilityChecker,
      eventPublisher,
    });

    const sessionQueries = createSessionQueriesUseCase({
      sessionRepo: sessionStore,
      terminalRepo: sessionLog,
    });

    const startupOps = {
      cleanupOrphanedSessions: () => sessionStore.markOrphanedEnded(),
      pruneOldSessions: () => sessionStore.pruneOld(),
      checkResumableForAll: () => checkResumability.checkResumableForAll(),
      checkResumableForActive: () => checkResumability.checkResumableForActive(),
    };

    return {
      spawnSession,
      sessionLifecycle,
      sessionCleanup,
      sessionQueries,
      checkResumability,
      ptyManager,
      terminalSubs,
      startupOps,
    };
  })
).pipe(Layer.provide(AgentSessionInfraLive));

function fireAndForget(effect: Effect.Effect<void>): void {
  Effect.runFork(
    Effect.catchCause(effect, (cause) =>
      Effect.logWarning('Callback event failed (non-fatal)', cause)
    )
  );
}
