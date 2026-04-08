import { ServiceMap } from 'effect';
import type { BrowserEvent } from '#shared/contracts/browser-events';

export type { BrowserEvent } from '#shared/contracts/browser-events';

export interface BrowserEventBusShape {
  subscribe(listener: (event: BrowserEvent) => void): () => void;
}

export class BrowserEventBus extends ServiceMap.Service<BrowserEventBus, BrowserEventBusShape>()(
  '@vigie/BrowserEventBus'
) {}
