import { Effect } from 'effect';
import { sessionStore, sessionToDaemon } from '../adapters/secondary/shared-state';

export const clearEndedSessions = (daemonId: string): Effect.Effect<{ deletedCount: number }> =>
  Effect.sync(() => {
    let deletedCount = 0;
    for (const [id, session] of sessionStore) {
      if (session.daemonId === daemonId && session.status === 'ended') {
        sessionStore.delete(id);
        sessionToDaemon.delete(id);
        deletedCount++;
      }
    }
    return { deletedCount };
  });
