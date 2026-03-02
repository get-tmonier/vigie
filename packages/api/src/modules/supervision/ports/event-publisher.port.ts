import type { SSEEvent } from '@tmonier/shared';
import { type Effect, ServiceMap } from 'effect';

interface EventPublisherShape {
  readonly publish: (daemonId: string, event: SSEEvent) => Effect.Effect<void>;
  readonly subscribe: (
    daemonId: string,
    callback: (event: SSEEvent) => void
  ) => Effect.Effect<() => void>;
}

export class EventPublisher extends ServiceMap.Service<EventPublisher, EventPublisherShape>()(
  'EventPublisher'
) {}
