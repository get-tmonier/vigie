import { Data, Effect, Layer } from 'effect';
import { DomainEventBus } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type { SessionEvent } from '#shared/kernel/session/events';

class DomainEventBusError extends Data.TaggedError('DomainEventBusError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const DomainEventBusLive = Layer.sync(DomainEventBus)(() => {
  const listeners = new Set<(event: SessionEvent) => void>();
  return {
    publish(event: SessionEvent): Effect.Effect<void> {
      return Effect.gen(function* () {
        for (const listener of listeners) {
          yield* Effect.try({
            try: () => listener(event),
            catch: (cause) => new DomainEventBusError({ message: String(cause), cause }),
          }).pipe(Effect.catch((err) => Effect.logError(`domain listener error: ${err}`)));
        }
      });
    },
    subscribe(listener: (event: SessionEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});
