import type { BrowserEvent } from './schemas';

export function createEventBus() {
  const listeners = new Set<(event: BrowserEvent) => void>();

  return {
    subscribe(listener: (event: BrowserEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(event: BrowserEvent): void {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {}
      }
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;
