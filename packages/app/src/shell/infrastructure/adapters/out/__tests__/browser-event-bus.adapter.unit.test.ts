import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import { DomainEventBus } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { SessionEvent } from '#shared/kernel/session/events';
import type { VigieEvent } from '#shell/application/ports/out/browser-event-bus.port';
import { BrowserEventBus } from '#shell/application/ports/out/browser-event-bus.port';
import { BrowserEventBusLive } from '../browser-event-bus.adapter';

// --- Fake DomainEventBus ---

function makeFakeDomainEventBus(): {
  layer: Layer.Layer<DomainEventBus>;
  emit: (event: SessionEvent) => void;
} {
  let capturedListener: ((event: SessionEvent) => void) | null = null;

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

const makeSessionStartedEvent = (): SessionEvent => ({
  type: 'session:started',
  sessionId: 'session-1' as ReturnType<
    typeof import('#shared/kernel/session/session-id').SessionId
  >,
  agentType: 'claude',
  mode: 'interactive',
  cwd: '/tmp',
  timestamp: 1000,
});

// --- Tests ---

describe('BrowserEventBusLive', () => {
  it('listener receives a VigieEvent when a matching SessionEvent is published', async () => {
    const { layer: fakePublisherLayer, emit } = makeFakeDomainEventBus();
    const testLayer = BrowserEventBusLive.pipe(Layer.provide(fakePublisherLayer));

    const received: VigieEvent[] = [];

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

  it('unsubscribe stops future deliveries', async () => {
    const { layer: fakePublisherLayer, emit } = makeFakeDomainEventBus();
    const testLayer = BrowserEventBusLive.pipe(Layer.provide(fakePublisherLayer));

    const received: VigieEvent[] = [];

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
