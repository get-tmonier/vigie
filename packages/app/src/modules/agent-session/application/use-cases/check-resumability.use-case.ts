import { Effect } from 'effect';
import type { AgentCatalogShape } from '#modules/agent-session/application/ports/out/agent-catalog.port';
import type { SessionEventBusShape } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { SessionStoreShape } from '#modules/agent-session/application/ports/out/session-store.port';
import type { SessionLifecycleEvent } from '#shared/kernel/session/events';

interface CheckResumabilityDeps {
  sessionRepo: SessionStoreShape;
  agentCatalog: AgentCatalogShape;
  eventPublisher: SessionEventBusShape;
}

export function createCheckResumabilityUseCase(deps: CheckResumabilityDeps) {
  const { sessionRepo, agentCatalog, eventPublisher } = deps;

  function publishEvents(events: SessionLifecycleEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  function fireAndForget(effect: Effect.Effect<void>): void {
    Effect.runFork(
      Effect.catchCause(effect, (cause) =>
        Effect.logWarning('Event publish failed (non-fatal)', cause)
      )
    );
  }

  return {
    checkResumableForAll(): void {
      sessionRepo.findAll().forEach((session) => {
        if (session.agentSessionId) {
          const adapter = agentCatalog.resolve(session.agentType);
          const resumable = adapter.isResumable(session.agentSessionId, session.cwd);
          if (resumable !== session.resumable) {
            session.setResumable(resumable);
            sessionRepo.save(session);
            fireAndForget(publishEvents(session.pullEvents()));
          }
        }
      });
    },

    checkResumableForActive(): void {
      const activeSessions = sessionRepo.findActiveWithAgentId();
      for (const row of activeSessions) {
        const adapter = agentCatalog.resolve(row.agentType);
        const isResumable = adapter.isResumable(row.agentSessionId, row.cwd);
        if (isResumable !== row.resumable) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(isResumable);
            sessionRepo.save(session);
            fireAndForget(publishEvents(session.pullEvents()));
          }
        }
      }

      const recentlyEnded = sessionRepo.findRecentlyEnded(5 * 60 * 1000);
      for (const row of recentlyEnded) {
        const adapter = agentCatalog.resolve(row.agentType);
        if (adapter.isResumable(row.agentSessionId, row.cwd)) {
          const session = sessionRepo.findById(row.id);
          if (session) {
            session.setResumable(true);
            sessionRepo.save(session);
            fireAndForget(publishEvents(session.pullEvents()));
          }
        }
      }
    },
  };
}
