import { Data, Effect, Layer } from 'effect';
import {
  SessionOutput,
  type SessionOutputShape,
} from '#modules/agent-session/application/ports/out/session-output.port';
import type { SessionId } from '#shared/kernel/session/session-id';

class SessionOutputError extends Data.TaggedError('SessionOutputError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

function createSessionOutput(): SessionOutputShape {
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
              catch: (cause) => new SessionOutputError({ message: String(cause), cause }),
            }).pipe(Effect.catch((err) => Effect.logError(`session output error: ${err}`)));
          }
        }
      });
    },
    hasSubscribers(sessionId: SessionId): boolean {
      return (subscribers.get(sessionId)?.size ?? 0) > 0;
    },
  };
}

export const SessionOutputLive = Layer.sync(SessionOutput)(() => createSessionOutput());
