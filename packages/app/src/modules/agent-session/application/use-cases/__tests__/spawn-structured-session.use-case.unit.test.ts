import { describe, expect, it } from 'bun:test';
import { Effect, Stream } from 'effect';
import type { StructuredEventStoreShape } from '#modules/agent-session/application/ports/out/structured-event-store.port';
import type { StructuredEvent } from '#shared/kernel/session/events';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import { createSpawnStructuredSessionUseCase } from '../spawn-structured-session.use-case';
import { makeSessionEventBus, makeSessionRepo } from './test-helpers';

function makeStructuredEventStore(): StructuredEventStoreShape & { inserted: unknown[] } {
  const inserted: unknown[] = [];
  return {
    inserted,
    insertTurn: (e) => {
      inserted.push(e);
    },
    completeTurn: (e) => {
      inserted.push(e);
    },
    insertTextDelta: (e) => {
      inserted.push(e);
    },
    insertToolCall: (e) => {
      inserted.push(e);
    },
    updateToolCall: (e) => {
      inserted.push(e);
    },
    insertCostUpdate: (e) => {
      inserted.push(e);
    },
    insertSubagentSpawn: (e) => {
      inserted.push(e);
    },
    getTurns: () => [],
    getToolCalls: () => [],
    getCostUpdates: () => [],
    getTextDeltas: () => [],
    getSubagentSpawns: () => [],
    getSessionTotalCost: () => 0,
  };
}

describe('SpawnStructuredSession', () => {
  it('creates a session with structured type', async () => {
    const sessionRepo = makeSessionRepo();
    const eventStore = makeStructuredEventStore();

    const useCase = createSpawnStructuredSessionUseCase({
      sessionRepo,
      eventPublisher: makeSessionEventBus(),
      structuredEventStore: eventStore,
      spawnStructuredFn: () => Stream.empty,
    });

    const result = await Effect.runPromise(
      useCase.spawn({
        agentType: 'claude',
        cwd: '/tmp',
        prompt: 'hello',
        autoAdvance: false,
      })
    );

    const session = sessionRepo.findById(result.sessionId);
    expect(session).not.toBeNull();
    expect(session?.sessionType).toBe('structured');
    expect(session?.autoAdvance).toBe(false);
  });

  it('persists structured events from stream', async () => {
    const sessionRepo = makeSessionRepo();
    const eventStore = makeStructuredEventStore();
    const eventBus = makeSessionEventBus();

    const sessionId = makeSessionId('test-sess');
    const events: StructuredEvent[] = [
      {
        type: 'agent:turn-started',
        sessionId,
        turnIndex: 0,
        prompt: 'hello',
        mode: 'manual' as const,
        timestamp: Date.now(),
      },
      {
        type: 'agent:text-delta',
        sessionId,
        turnIndex: 0,
        role: 'assistant' as const,
        content: 'Hi there',
        timestamp: Date.now(),
      },
      {
        type: 'agent:turn-completed',
        sessionId,
        turnIndex: 0,
        stopReason: 'end_turn' as const,
        timestamp: Date.now(),
      },
    ];

    const useCase = createSpawnStructuredSessionUseCase({
      sessionRepo,
      eventPublisher: eventBus,
      structuredEventStore: eventStore,
      spawnStructuredFn: () => Stream.fromIterable(events),
    });

    await Effect.runPromise(
      useCase.spawn({
        agentType: 'claude',
        cwd: '/tmp',
        prompt: 'hello',
        autoAdvance: false,
      })
    );

    // Give the forked fiber time to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(eventStore.inserted.length).toBeGreaterThanOrEqual(3);
  });
});
