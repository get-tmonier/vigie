import { Effect } from 'effect';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';

interface SessionCleanupDeps {
  sessionRepo: SessionRepositoryShape;
  eventPublisher: EventPublisherShape;
}

export type SessionCleanupShape = ReturnType<typeof createSessionCleanupUseCase>;

export function createSessionCleanupUseCase(deps: SessionCleanupDeps) {
  const { sessionRepo, eventPublisher } = deps;

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
    return Effect.forEach(events, (event) => eventPublisher.publish(event), { discard: true });
  }

  return {
    delete(sessionId: string): void {
      const id = makeSessionId(sessionId);
      const session = sessionRepo.findById(id);
      if (!session) return;
      session.delete();
      sessionRepo.delete(id);
      Effect.runFork(publishEvents(session.pullEvents()));
    },

    deleteAllEnded(): void {
      sessionRepo.deleteAllEnded();
      Effect.runFork(eventPublisher.publish({ type: 'sessions:cleared', timestamp: Date.now() }));
    },
  };
}
