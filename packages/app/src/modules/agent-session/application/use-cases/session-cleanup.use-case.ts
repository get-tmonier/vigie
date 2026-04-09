import { Effect } from 'effect';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { SessionStoreShape } from '#modules/agent-session/application/ports/out/session-store.port';
import type { SessionLifecycleEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

interface SessionCleanupDeps {
  sessionRepo: SessionStoreShape;
  eventPublisher: DomainEventBusShape;
}

export type SessionCleanupShape = ReturnType<typeof createSessionCleanupUseCase>;

export function createSessionCleanupUseCase(deps: SessionCleanupDeps) {
  const { sessionRepo, eventPublisher } = deps;

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
    delete(sessionId: SessionId): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.delete();
      sessionRepo.delete(sessionId);
      fireAndForget(publishEvents(session.pullEvents()));
    },

    deleteAllEnded(): void {
      sessionRepo.deleteAllEnded();
      fireAndForget(eventPublisher.publish({ type: 'sessions:cleared', timestamp: Date.now() }));
    },
  };
}
