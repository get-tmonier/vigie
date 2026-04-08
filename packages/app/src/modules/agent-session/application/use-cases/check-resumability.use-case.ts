import { Effect } from 'effect';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { SessionDomainEvent } from '#modules/agent-session/domain/events';

interface CheckResumabilityDeps {
  sessionRepo: SessionRepositoryShape;
  resumabilityChecker: ResumabilityCheckerShape;
  eventPublisher: EventPublisherShape;
}

export function createCheckResumabilityUseCase(deps: CheckResumabilityDeps) {
  const { sessionRepo, resumabilityChecker, eventPublisher } = deps;

  function publishEvents(events: SessionDomainEvent[]): Effect.Effect<void> {
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
          const resumable = resumabilityChecker.isResumable(session.agentSessionId, session.cwd);
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
        const isResumable = resumabilityChecker.isResumable(row.agentSessionId, row.cwd);
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
        if (resumabilityChecker.isResumable(row.agentSessionId, row.cwd)) {
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
