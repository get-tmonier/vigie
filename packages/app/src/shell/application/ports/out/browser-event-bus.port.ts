import { ServiceMap } from 'effect';
import type { SessionEvent } from '#shared/kernel/session/events';

export interface BrowserEventBusShape {
  subscribe(listener: (event: SessionEvent) => void): () => void;
}

export class BrowserEventBus extends ServiceMap.Service<BrowserEventBus, BrowserEventBusShape>()(
  '@vigie/BrowserEventBus'
) {}
