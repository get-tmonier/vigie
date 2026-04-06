export interface DaemonEvent {
  type: string;
  [key: string]: unknown;
}

export function createEventBus() {
  const listeners = new Set<(event: DaemonEvent) => void>();

  return {
    subscribe(listener: (event: DaemonEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(event: DaemonEvent): void {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {}
      }
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;
