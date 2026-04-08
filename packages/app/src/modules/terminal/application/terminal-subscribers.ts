import { Data, Effect, Layer, ServiceMap } from 'effect';

class TerminalSubscriberError extends Data.TaggedError('TerminalSubscriberError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

function createTerminalSubscribers(): TerminalSubscribersShape {
  const subscribers = new Map<string, Set<(data: string) => void>>();

  return {
    subscribe(sessionId: string, callback: (data: string) => void): () => void {
      if (!subscribers.has(sessionId)) {
        subscribers.set(sessionId, new Set());
      }
      subscribers.get(sessionId)?.add(callback);
      return () => {
        subscribers.get(sessionId)?.delete(callback);
        if (subscribers.get(sessionId)?.size === 0) {
          subscribers.delete(sessionId);
        }
      };
    },
    publish(sessionId: string, data: string): Effect.Effect<void> {
      return Effect.gen(function* () {
        const subs = subscribers.get(sessionId);
        if (subs) {
          for (const cb of subs) {
            yield* Effect.try({
              try: () => cb(data),
              catch: (cause) => new TerminalSubscriberError({ message: String(cause), cause }),
            }).pipe(Effect.catch((err) => Effect.logError(`terminal subscriber error: ${err}`)));
          }
        }
      });
    },
    hasSubscribers(sessionId: string): boolean {
      return (subscribers.get(sessionId)?.size ?? 0) > 0;
    },
  };
}

export type TerminalSubscribersShape = {
  subscribe(sessionId: string, callback: (data: string) => void): () => void;
  publish(sessionId: string, data: string): Effect.Effect<void>;
  hasSubscribers(sessionId: string): boolean;
};

export class TerminalSubscribers extends ServiceMap.Service<
  TerminalSubscribers,
  TerminalSubscribersShape
>()('@vigie/TerminalSubscribers') {}

export const TerminalSubscribersLayer = Layer.sync(TerminalSubscribers)(() =>
  createTerminalSubscribers()
);
