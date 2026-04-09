import { Data, Effect, Layer } from 'effect';
import {
  SessionFeed,
  type SessionFeedShape,
} from '#modules/agent-session/application/ports/out/session-feed.port';
import type { SessionId } from '#shared/kernel/session/session-id';

class SessionFeedError extends Data.TaggedError('SessionFeedError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

function createSessionFeed(): SessionFeedShape {
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
              catch: (cause) => new SessionFeedError({ message: String(cause), cause }),
            }).pipe(Effect.catch((err) => Effect.logError(`session feed error: ${err}`)));
          }
        }
      });
    },
    hasSubscribers(sessionId: SessionId): boolean {
      return (subscribers.get(sessionId)?.size ?? 0) > 0;
    },
  };
}

export const SessionFeedLive = Layer.sync(SessionFeed)(() => createSessionFeed());
