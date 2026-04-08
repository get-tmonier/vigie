import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import { DomainEventBus } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { BrowserEvent } from '#modules/agent-session/application/ports/out/event-feed.port';
import { EventFeed } from '#modules/agent-session/application/ports/out/event-feed.port';
import type { DomainEvent } from '#modules/agent-session/domain/events';
import { EventFeedLive } from '../event-feed.adapter';

// --- Fake DomainEventBus ---

function makeFakeDomainEventBus(): {
  layer: Layer.Layer<DomainEventBus>;
  emit: (event: DomainEvent) => void;
} {
  let capturedListener: ((event: DomainEvent) => void) | null = null;

  const shape: DomainEventBusShape = {
    publish: (_event) => Effect.void,
    subscribe: (listener) => {
      capturedListener = listener;
      return () => {
        capturedListener = null;
      };
    },
  };

  const layer = Layer.succeed(DomainEventBus, shape);

  return {
    layer,
    emit: (event) => {
      capturedListener?.(event);
    },
  };
}

// --- Test helpers ---

const makeSessionStartedEvent = (): DomainEvent => ({
  type: 'session:started',
  sessionId: 'session-1' as ReturnType<
    typeof import('#modules/agent-session/domain/session-id').SessionId
  >,
  agentType: 'claude',
  mode: 'interactive',
  cwd: '/tmp',
  timestamp: 1000,
});

const makeTerminalOutputEvent = (): DomainEvent => ({
  type: 'terminal:output',
  sessionId: 'session-1',
  data: 'some output',
  timestamp: 1000,
});

// --- Tests ---

describe('EventFeedLive', () => {
  it('listener receives a BrowserEvent when a matching DomainEvent is published', async () => {
    const { layer: fakePublisherLayer, emit } = makeFakeDomainEventBus();
    const testLayer = EventFeedLive.pipe(Layer.provide(fakePublisherLayer));

    const received: BrowserEvent[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const eventFeed = yield* EventFeed;
        eventFeed.subscribe((event) => {
          received.push(event);
        });
        emit(makeSessionStartedEvent());
        // Allow microtasks to flush (runForkWith schedules work)
        yield* Effect.sleep(0);
      }).pipe(Effect.provide(testLayer))
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'session:started', sessionId: 'session-1' });
  });

  it('listener does NOT receive an event for an unmapped domain event (terminal:output → null)', async () => {
    const { layer: fakePublisherLayer, emit } = makeFakeDomainEventBus();
    const testLayer = EventFeedLive.pipe(Layer.provide(fakePublisherLayer));

    const received: BrowserEvent[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const eventFeed = yield* EventFeed;
        eventFeed.subscribe((event) => {
          received.push(event);
        });
        emit(makeTerminalOutputEvent());
        yield* Effect.sleep(0);
      }).pipe(Effect.provide(testLayer))
    );

    expect(received).toHaveLength(0);
  });

  it('unsubscribe stops future deliveries', async () => {
    const { layer: fakePublisherLayer, emit } = makeFakeDomainEventBus();
    const testLayer = EventFeedLive.pipe(Layer.provide(fakePublisherLayer));

    const received: BrowserEvent[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const eventFeed = yield* EventFeed;
        const unsubscribe = eventFeed.subscribe((event) => {
          received.push(event);
        });

        emit(makeSessionStartedEvent());
        yield* Effect.sleep(0);

        unsubscribe();

        emit(makeSessionStartedEvent());
        yield* Effect.sleep(0);
      }).pipe(Effect.provide(testLayer))
    );

    expect(received).toHaveLength(1);
  });
});
