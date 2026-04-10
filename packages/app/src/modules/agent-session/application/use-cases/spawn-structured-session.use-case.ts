import { Effect, Stream } from 'effect';
import type { SessionEventBusShape } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { SessionStoreShape } from '#modules/agent-session/application/ports/out/session-store.port';
import type { StructuredEventStoreShape } from '#modules/agent-session/application/ports/out/structured-event-store.port';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import type { AgentType } from '#shared/kernel/session/agent-type';
import type { SessionLifecycleEvent, StructuredEvent } from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

interface SpawnStructuredDeps {
  sessionRepo: SessionStoreShape;
  eventPublisher: SessionEventBusShape;
  structuredEventStore: StructuredEventStoreShape;
  spawnStructuredFn: (options: {
    sessionId: SessionId;
    prompt: string;
    cwd: string;
    autoAdvance: boolean;
    agentSessionId?: string;
    resume?: boolean;
  }) => Stream.Stream<StructuredEvent, AgentRunnerError>;
}

export type SpawnStructuredSessionShape = ReturnType<typeof createSpawnStructuredSessionUseCase>;

export function createSpawnStructuredSessionUseCase(deps: SpawnStructuredDeps) {
  const { sessionRepo, eventPublisher, structuredEventStore, spawnStructuredFn } = deps;

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

  function persistEvent(event: StructuredEvent): void {
    switch (event.type) {
      case 'agent:turn-started':
        structuredEventStore.insertTurn(event);
        break;
      case 'agent:turn-completed':
        structuredEventStore.completeTurn(event);
        break;
      case 'agent:text-delta':
        structuredEventStore.insertTextDelta(event);
        break;
      case 'agent:tool-call':
        if (event.status === 'running') {
          structuredEventStore.insertToolCall(event);
        } else {
          structuredEventStore.updateToolCall(event);
        }
        break;
      case 'agent:cost-update':
        structuredEventStore.insertCostUpdate(event);
        break;
      case 'agent:subagent-spawn':
        structuredEventStore.insertSubagentSpawn(event);
        break;
    }
  }

  return {
    spawn(props: {
      agentType: AgentType;
      cwd: string;
      prompt: string;
      autoAdvance: boolean;
      gitBranch?: string;
      repoName?: string;
    }): Effect.Effect<{ sessionId: SessionId }, AgentRunnerError> {
      return Effect.gen(function* () {
        const session = Session.create({
          agentType: props.agentType,
          cwd: props.cwd,
          mode: 'prompt',
          sessionType: 'structured',
          autoAdvance: props.autoAdvance,
          gitBranch: props.gitBranch,
          repoName: props.repoName,
        });
        sessionRepo.save(session);
        fireAndForget(publishEvents(session.pullEvents()));

        const stream = spawnStructuredFn({
          sessionId: session.id,
          prompt: props.prompt,
          cwd: props.cwd,
          autoAdvance: props.autoAdvance,
        });

        yield* Effect.forkDetach(
          Stream.runForEach(stream, (event) =>
            Effect.sync(() => {
              persistEvent(event);
              fireAndForget(eventPublisher.publish(event));

              if (event.type === 'agent:cost-update') {
                session.addCost(event.totalCostUsd);
                sessionRepo.save(session);
              }
              if (event.type === 'agent:turn-completed') {
                if (event.stopReason === 'end_turn' || event.stopReason === 'pause') {
                  session.markPaused();
                } else if (event.stopReason === 'error') {
                  session.markError('Agent turn ended with error');
                }
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              }
            })
          ).pipe(
            Effect.catch((err) =>
              Effect.sync(() => {
                session.markError(String(err));
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              })
            )
          )
        );

        return { sessionId: session.id };
      });
    },

    sendPrompt(sessionId: SessionId, prompt: string): Effect.Effect<void, AgentRunnerError> {
      return Effect.gen(function* () {
        const session = sessionRepo.findById(sessionId);
        if (!session || session.status !== 'paused') return;

        session.reactivate();
        session.advanceTurn();
        sessionRepo.save(session);
        fireAndForget(publishEvents(session.pullEvents()));

        const stream = spawnStructuredFn({
          sessionId,
          prompt,
          cwd: session.cwd,
          autoAdvance: session.autoAdvance,
          agentSessionId: session.agentSessionId ?? undefined,
          resume: true,
        });

        yield* Effect.forkDetach(
          Stream.runForEach(stream, (event) =>
            Effect.sync(() => {
              persistEvent(event);
              fireAndForget(eventPublisher.publish(event));

              if (event.type === 'agent:cost-update') {
                session.addCost(event.totalCostUsd);
                sessionRepo.save(session);
              }
              if (event.type === 'agent:turn-completed') {
                if (event.stopReason === 'end_turn' || event.stopReason === 'pause') {
                  session.markPaused();
                } else if (event.stopReason === 'error') {
                  session.markError('Agent turn ended with error');
                }
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              }
            })
          ).pipe(
            Effect.catch((err) =>
              Effect.sync(() => {
                session.markError(String(err));
                sessionRepo.save(session);
                fireAndForget(publishEvents(session.pullEvents()));
              })
            )
          )
        );
      });
    },
  };
}
