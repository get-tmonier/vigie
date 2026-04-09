import { ServiceMap } from 'effect';
import type { VigieEvent } from '#shared/contracts/vigie-events';

export type { VigieEvent } from '#shared/contracts/vigie-events';

export interface BrowserEventBusShape {
  subscribe(listener: (event: VigieEvent) => void): () => void;
}

export class BrowserEventBus extends ServiceMap.Service<BrowserEventBus, BrowserEventBusShape>()(
  '@vigie/BrowserEventBus'
) {}
