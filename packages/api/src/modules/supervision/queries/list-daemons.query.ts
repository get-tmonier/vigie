import { Effect } from 'effect';
import { DaemonReadRepository } from '../ports/daemon-read-repository.port';

export const listDaemons = () =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonReadRepository);
    return yield* repo.list();
  });
