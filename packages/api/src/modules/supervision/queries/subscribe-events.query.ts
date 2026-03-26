import type { SSEEvent } from '@vigie/shared';
import { Effect } from 'effect';
import { EventPublisher } from '../ports/event-publisher.port';

export const subscribeToEvents = (daemonId: string, callback: (event: SSEEvent) => void) =>
  Effect.gen(function* () {
    const publisher = yield* Effect.service(EventPublisher);
    return yield* publisher.subscribe(daemonId, callback);
  });
