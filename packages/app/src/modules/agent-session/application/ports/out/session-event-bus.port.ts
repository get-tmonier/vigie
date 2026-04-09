import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { SessionEvent } from '#shared/kernel/session/events';

export interface SessionEventBusShape {
  publish(event: SessionEvent): Effect.Effect<void>;
  subscribe(listener: (event: SessionEvent) => void): () => void;
}

export class SessionEventBus extends ServiceMap.Service<SessionEventBus, SessionEventBusShape>()(
  '@vigie/SessionEventBus'
) {}
