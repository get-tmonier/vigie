import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import { DomainEventBus } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { AgentSessionEvent } from '#modules/agent-session/domain/events';
import type { BrowserEvent } from '#shell/application/ports/out/browser-event-bus.port';
import { BrowserEventBus } from '#shell/application/ports/out/browser-event-bus.port';
import { BrowserEventBusLive } from '../browser-event-bus.adapter';

// --- Fake DomainEventBus ---

function makeFakeDomainEventBus(): {
  layer: Layer.Layer<DomainEventBus>;
  emit: (event: AgentSessionEvent) => void;
} {
  let capturedListener: ((event: AgentSessionEvent) => void) | null = null;

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

const makeSessionStartedEvent = (): AgentSessionEvent => ({
  type: 'session:started',
  sessionId: 'session-1' as ReturnType<
    typeof import('#modules/agent-session/domain/session-id').SessionId
  >,
  agentType: 'claude',
  mode: 'interactive',
  cwd: '/tmp',
  timestamp: 1000,
});

const makeTerminalOutputEvent = (): AgentSessionEvent => ({
  type: 'terminal:output',
  sessionId: 'session-1',
  data: 'some output',
  timestamp: 1000,
});

// --- Tests ---

describe('BrowserEventBusLive', () => {
  it('listener receives a BrowserEvent when a matching AgentSessionEvent is published', async () => {
    const { layer: fakePublisherLayer, emit } = makeFakeDomainEventBus();
    const testLayer = BrowserEventBusLive.pipe(Layer.provide(fakePublisherLayer));

    const received: BrowserEvent[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const browserEventBus = yield* BrowserEventBus;
        browserEventBus.subscribe((event) => {
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
    const testLayer = BrowserEventBusLive.pipe(Layer.provide(fakePublisherLayer));

    const received: BrowserEvent[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const browserEventBus = yield* BrowserEventBus;
        browserEventBus.subscribe((event) => {
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
    const testLayer = BrowserEventBusLive.pipe(Layer.provide(fakePublisherLayer));

    const received: BrowserEvent[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const browserEventBus = yield* BrowserEventBus;
        const unsubscribe = browserEventBus.subscribe((event) => {
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
