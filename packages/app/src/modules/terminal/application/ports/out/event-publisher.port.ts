import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { DomainEvent } from '#shared/kernel/domain-events';

export interface EventPublisherShape {
  publish(event: DomainEvent): Effect.Effect<void>;
  subscribe(listener: (event: DomainEvent) => void): () => void;
}

export class EventPublisher extends ServiceMap.Service<EventPublisher, EventPublisherShape>()(
  '@vigie/EventPublisher'
) {}
