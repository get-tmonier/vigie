import { Effect, Layer } from 'effect';
import { DaemonReadRepository } from '../../ports/daemon-read-repository.port.js';
import { DaemonNotFoundError } from '../../ports/errors.js';
import { daemonStore } from './shared-state.js';

export const InMemoryDaemonReadRepositoryLive = Layer.succeed(DaemonReadRepository, {
  get: (id) =>
    Effect.gen(function* () {
      const entry = daemonStore.get(id);
      if (!entry) {
        return yield* Effect.fail(new DaemonNotFoundError({ id }));
      }
      return entry.session;
    }),
  list: () => Effect.sync(() => Array.from(daemonStore.values()).map((entry) => entry.session)),
});
