import { Data, Effect, Layer } from 'effect';
import { DomainEventBus } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { SessionEvent } from '#shared/kernel/session/events';
import { BrowserEventBus } from '#shell/application/ports/out/browser-event-bus.port';

class BrowserEventBusError extends Data.TaggedError('BrowserEventBusError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const BrowserEventBusLive = Layer.effect(BrowserEventBus)(
  Effect.gen(function* () {
    const eventPublisher = yield* DomainEventBus;
    const listeners = new Set<(event: SessionEvent) => void>();
    // Capture service context so fire-and-forget listener dispatch via Effect.runForkWith has access to all services
    const services = yield* Effect.services();

    eventPublisher.subscribe((event) => {
      for (const listener of listeners) {
        Effect.runForkWith(services)(
          Effect.try({
            try: () => listener(event),
            catch: (cause) => new BrowserEventBusError({ message: String(cause), cause }),
          }).pipe(Effect.catch((err) => Effect.logError(`vigie event listener error: ${err}`)))
        );
      }
    });

    return {
      subscribe(listener: (event: SessionEvent) => void): () => void {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  })
);
