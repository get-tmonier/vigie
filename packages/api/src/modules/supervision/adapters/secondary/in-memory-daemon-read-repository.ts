import { Effect, Layer } from 'effect';
import { DaemonReadRepository } from '#modules/supervision/ports/daemon-read-repository.port';
import { DaemonNotFoundError } from '#modules/supervision/ports/errors';
import { daemonStore } from './shared-state';

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
