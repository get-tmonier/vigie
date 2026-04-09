// Subscribe-only bus that fans session lifecycle events out to browser WebSocket connections.
// Publish side lives in agent-session (SessionEventBus); adapted to this at the composition root.
import { ServiceMap } from 'effect';
import type { SessionEvent } from '#shared/kernel/session/events';

export interface BrowserEventBusShape {
  subscribe(listener: (event: SessionEvent) => void): () => void;
}

export class BrowserEventBus extends ServiceMap.Service<BrowserEventBus, BrowserEventBusShape>()(
  '@vigie/BrowserEventBus'
) {}
