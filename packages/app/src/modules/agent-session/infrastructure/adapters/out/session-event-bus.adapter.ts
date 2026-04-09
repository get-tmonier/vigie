import { Data, Effect, Layer } from 'effect';
import { SessionEventBus } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { SessionEvent } from '#shared/kernel/session/events';

class SessionEventBusError extends Data.TaggedError('SessionEventBusError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const SessionEventBusLive = Layer.sync(SessionEventBus)(() => {
  const listeners = new Set<(event: SessionEvent) => void>();
  return {
    publish(event: SessionEvent): Effect.Effect<void> {
      return Effect.gen(function* () {
        for (const listener of listeners) {
          yield* Effect.try({
            try: () => listener(event),
            catch: (cause) => new SessionEventBusError({ message: String(cause), cause }),
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
