import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { SessionLifecycleEvent } from '#shared/kernel/agent-session/events';
import type { SessionId } from '#shared/kernel/agent-session/session-id';
import type { PtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';

interface SessionLifecycleDeps {
  sessionRepo: SessionRepositoryShape;
  resumabilityChecker: ResumabilityCheckerShape;
  agentRegistry: AgentRegistryShape;
  eventPublisher: DomainEventBusShape;
  registry: PtyRegistry;
}

export function createSessionLifecycleUseCase(deps: SessionLifecycleDeps) {
  const { sessionRepo, resumabilityChecker, agentRegistry, eventPublisher, registry } = deps;

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
    markEnded(sessionId: SessionId, exitCode: number): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;

      const adapter = agentRegistry.resolve(session.agentType);
      const resumable =
        adapter.canResume &&
        session.agentSessionId != null &&
        resumabilityChecker.isResumable(session.agentSessionId, session.cwd);

      session.markEnded(exitCode, resumable);
      sessionRepo.save(session);
      fireAndForget(publishEvents(session.pullEvents()));
    },

    markError(sessionId: SessionId, error: string): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.markError(error);
      sessionRepo.save(session);
      fireAndForget(publishEvents(session.pullEvents()));
    },

    setAgentSessionId(sessionId: SessionId, agentSessionId: string): void {
      const session = sessionRepo.findById(sessionId);
      if (!session) return;
      session.setAgentSessionId(agentSessionId);
      sessionRepo.save(session);
      fireAndForget(publishEvents(session.pullEvents()));
    },

    deregister(sessionId: SessionId): void {
      const session = sessionRepo.findById(sessionId);
      if (session) {
        session.markEnded(0, false);
        sessionRepo.save(session);
        fireAndForget(publishEvents(session.pullEvents()));
      }

      const connId = registry.sessionConnections.get(sessionId);
      if (connId) {
        registry.connSessions.delete(connId);
      }
      registry.sessionConnections.delete(sessionId);
    },
  };
}
