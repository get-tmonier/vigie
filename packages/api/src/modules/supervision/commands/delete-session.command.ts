import { Effect } from 'effect';
import { sessionStore, sessionToDaemon } from '../adapters/secondary/shared-state';
import { SessionNotFoundError, SessionStillActiveError } from '../ports/errors';

export const deleteSession = (
  sessionId: string
): Effect.Effect<void, SessionNotFoundError | SessionStillActiveError> =>
  Effect.gen(function* () {
    const session = sessionStore.get(sessionId);
    if (!session) {
      return yield* Effect.fail(new SessionNotFoundError({ id: sessionId }));
    }
    if (session.status === 'active') {
      return yield* Effect.fail(new SessionStillActiveError({ id: sessionId }));
    }
    sessionStore.delete(sessionId);
    sessionToDaemon.delete(sessionId);
  });
