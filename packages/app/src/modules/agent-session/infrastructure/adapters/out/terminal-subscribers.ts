import { Data, Effect, Layer, ServiceMap } from 'effect';
import type { SessionId } from '#shared/kernel/session/session-id';

class TerminalSubscriberError extends Data.TaggedError('TerminalSubscriberError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

function createTerminalSubscribers(): TerminalSubscribersShape {
  const subscribers = new Map<SessionId, Set<(data: string) => void>>();

  return {
    subscribe(sessionId: SessionId, callback: (data: string) => void): () => void {
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
    publish(sessionId: SessionId, data: string): Effect.Effect<void> {
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
    hasSubscribers(sessionId: SessionId): boolean {
      return (subscribers.get(sessionId)?.size ?? 0) > 0;
    },
  };
}

export type TerminalSubscribersShape = {
  subscribe(sessionId: SessionId, callback: (data: string) => void): () => void;
  publish(sessionId: SessionId, data: string): Effect.Effect<void>;
  hasSubscribers(sessionId: SessionId): boolean;
};

export class TerminalSubscribers extends ServiceMap.Service<
  TerminalSubscribers,
  TerminalSubscribersShape
>()('@vigie/TerminalSubscribers') {}

export const TerminalSubscribersLive = Layer.sync(TerminalSubscribers)(() =>
  createTerminalSubscribers()
);
