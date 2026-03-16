import { Effect, Layer } from 'effect';
import { DaemonWriteRepository } from '#modules/supervision/ports/daemon-write-repository.port';
import { DaemonNotFoundError } from '#modules/supervision/ports/errors';
import { daemonStore } from './shared-state';

export const InMemoryDaemonWriteRepositoryLive = Layer.succeed(DaemonWriteRepository, {
  register: (session, ws) =>
    Effect.sync(() => {
      daemonStore.set(session.id, { session, ws, lastPongAt: Date.now() });
      return session;
    }),
  unregister: (id) =>
    Effect.sync(() => {
      daemonStore.delete(id);
    }),
  getWs: (id) =>
    Effect.gen(function* () {
      const entry = daemonStore.get(id);
      if (!entry) {
        return yield* Effect.fail(new DaemonNotFoundError({ id }));
      }
      return entry.ws;
    }),
});
