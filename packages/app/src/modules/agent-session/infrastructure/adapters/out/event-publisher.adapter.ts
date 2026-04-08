import { Data, Effect, Layer } from 'effect';
import { EventPublisher } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { DomainEvent } from '#modules/agent-session/domain/events';

class EventPublisherError extends Data.TaggedError('EventPublisherError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const EventPublisherLive = Layer.sync(EventPublisher)(() => {
  const listeners = new Set<(event: DomainEvent) => void>();

  return {
    publish(event: DomainEvent): Effect.Effect<void> {
      return Effect.gen(function* () {
        for (const listener of listeners) {
          yield* Effect.try({
            try: () => listener(event),
            catch: (cause) => new EventPublisherError({ message: String(cause), cause }),
          }).pipe(Effect.catch((err) => Effect.logError(`domain listener error: ${err}`)));
        }
      });
    },

    subscribe(listener: (event: DomainEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});
