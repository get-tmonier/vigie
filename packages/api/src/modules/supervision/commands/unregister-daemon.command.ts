import { Effect } from 'effect';
import { DaemonReadRepository } from '../ports/daemon-read-repository.port';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { EventPublisher } from '../ports/event-publisher.port';

export const unregisterDaemon = (id: string) =>
  Effect.gen(function* () {
    const writeRepo = yield* Effect.service(DaemonWriteRepository);
    const readRepo = yield* Effect.service(DaemonReadRepository);
    const publisher = yield* Effect.service(EventPublisher);
    const session = yield* readRepo.get(id);
    yield* writeRepo.unregister(id);
    yield* publisher.publish(id, {
      type: 'daemon:disconnected',
      daemonId: id,
      hostname: session.hostname,
      timestamp: Date.now(),
    });
  });
