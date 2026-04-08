import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { DomainEvent } from '#modules/agent-session/domain/events';

export interface DomainEventBusShape {
  publish(event: DomainEvent): Effect.Effect<void>;
  subscribe(listener: (event: DomainEvent) => void): () => void;
}

export class DomainEventBus extends ServiceMap.Service<DomainEventBus, DomainEventBusShape>()(
  '@vigie/DomainEventBus'
) {}
