import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { SessionEvent } from '#modules/agent-session/domain/events';

export interface DomainEventBusShape {
  publish(event: SessionEvent): Effect.Effect<void>;
  subscribe(listener: (event: SessionEvent) => void): () => void;
}

export class DomainEventBus extends ServiceMap.Service<DomainEventBus, DomainEventBusShape>()(
  '@vigie/DomainEventBus'
) {}
