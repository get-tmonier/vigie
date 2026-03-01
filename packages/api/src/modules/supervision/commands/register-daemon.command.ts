import type { DaemonHello } from '@tmonier/shared';
import { Effect } from 'effect';
import { createDaemonSession } from '../domain/daemon-session';
import { DaemonWriteRepository } from '../ports/daemon-write-repository.port';
import { EventPublisher } from '../ports/event-publisher.port';

export const registerDaemon = (hello: DaemonHello, ws: WebSocket) =>
  Effect.gen(function* () {
    const repo = yield* Effect.service(DaemonWriteRepository);
    const publisher = yield* Effect.service(EventPublisher);
    const session = createDaemonSession(hello);
    yield* repo.register(session, ws);
    yield* publisher.publish(session.id, {
      type: 'daemon:connected',
      daemonId: session.id,
      hostname: session.hostname,
      timestamp: session.connectedAt,
    });
    return session;
  });
