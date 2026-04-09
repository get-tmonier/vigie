import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { AgentSessionEvent } from '#modules/agent-session/domain/events';

export interface DomainEventBusShape {
  publish(event: AgentSessionEvent): Effect.Effect<void>;
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
}

export class DomainEventBus extends ServiceMap.Service<DomainEventBus, DomainEventBusShape>()(
  '@vigie/DomainEventBus'
) {}
