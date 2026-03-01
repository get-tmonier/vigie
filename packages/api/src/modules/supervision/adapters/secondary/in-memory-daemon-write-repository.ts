import { Effect, Layer } from 'effect';
import { DaemonWriteRepository } from '../../ports/daemon-write-repository.port.js';
import { DaemonNotFoundError } from '../../ports/errors.js';
import { daemonStore } from './shared-state.js';

export const InMemoryDaemonWriteRepositoryLive = Layer.succeed(DaemonWriteRepository, {
  register: (session, ws) =>
    Effect.sync(() => {
      daemonStore.set(session.id, { session, ws });
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
