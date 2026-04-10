import { Effect, Layer, ServiceMap } from 'effect';
import { AgentCatalog } from '#modules/agent-session/application/ports/out/agent-catalog.port';
import type { AgentProcessShape } from '#modules/agent-session/application/ports/out/agent-process.port';
import { CliChannel } from '#modules/agent-session/application/ports/out/cli-channel.port';
import { SessionEventBus } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import { SessionLog } from '#modules/agent-session/application/ports/out/session-log.port';
import {
  SessionOutput,
  type SessionOutputShape,
} from '#modules/agent-session/application/ports/out/session-output.port';
import { SessionStore } from '#modules/agent-session/application/ports/out/session-store.port';
import { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import { AgentCatalogLive } from '#modules/agent-session/infrastructure/adapters/out/agents/agent-registry';
import { createBunPtySpawnFn } from '#modules/agent-session/infrastructure/adapters/out/bun-pty-spawner';
import { SqliteSessionRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-session-repository';
import { SqliteStructuredEventRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-structured-event-repository';
import { SqliteTerminalRepositoryLive } from '#modules/agent-session/infrastructure/adapters/out/sqlite-terminal-repository';
import { SessionOutputLive } from '#modules/agent-session/infrastructure/adapters/out/terminal-subscribers';
import { createPtyManager } from '#modules/agent-session/infrastructure/pty-manager';

export interface AgentSessionServices {
  spawnSession: ReturnType<typeof createSpawnSessionUseCase>;
  sessionLifecycle: ReturnType<typeof createSessionLifecycleUseCase>;
  sessionCleanup: ReturnType<typeof createSessionCleanupUseCase>;
  sessionQueries: ReturnType<typeof createSessionQueriesUseCase>;
  checkResumability: ReturnType<typeof createCheckResumabilityUseCase>;
  ptyManager: AgentProcessShape;
  terminalSubs: SessionOutputShape;
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
  AgentCatalogLive,
  SessionOutputLive,
  SqliteSessionRepositoryLive,
  SqliteTerminalRepositoryLive,
  SqliteStructuredEventRepositoryLive
);

export const AgentSessionLive = Layer.effect(AgentSession)(
  Effect.gen(function* () {
    const sessionStore = yield* SessionStore;
    const sessionLog = yield* SessionLog;
    const agentCatalog = yield* AgentCatalog;
    const eventPublisher = yield* SessionEventBus;
    const terminalSubs = yield* SessionOutput;
    const cliChannel = yield* CliChannel;

    const sessionLifecycle = createSessionLifecycleUseCase({
      sessionRepo: sessionStore,
      agentCatalog,
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
          cliChannel.send(connId, msg);
        },
      },
      terminalRepo: sessionLog,
    });

    const spawnSession = createSpawnSessionUseCase({
      sessionRepo: sessionStore,
      agentCatalog,
      eventPublisher,
      ptyManager,
    });

    const sessionCleanup = createSessionCleanupUseCase({
      sessionRepo: sessionStore,
      eventPublisher,
    });

    const checkResumability = createCheckResumabilityUseCase({
      sessionRepo: sessionStore,
      agentCatalog,
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
