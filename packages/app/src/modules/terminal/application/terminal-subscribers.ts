import { Layer, ServiceMap } from 'effect';

function createTerminalSubscribers(): TerminalSubscribersShape {
  const subscribers = new Map<string, Set<(data: string) => void>>();

  return {
    subscribe(sessionId: string, callback: (data: string) => void): () => void {
      if (!subscribers.has(sessionId)) {
        subscribers.set(sessionId, new Set());
      }
      subscribers.get(sessionId)?.add(callback);
      return () => {
        subscribers.get(sessionId)?.delete(callback);
        if (subscribers.get(sessionId)?.size === 0) {
          subscribers.delete(sessionId);
        }
      };
    },
    publish(sessionId: string, data: string): void {
      const subs = subscribers.get(sessionId);
      if (subs) {
        for (const cb of subs) {
          try {
            cb(data);
          } catch {}
        }
      }
    },
    hasSubscribers(sessionId: string): boolean {
      return (subscribers.get(sessionId)?.size ?? 0) > 0;
    },
  };
}

export type TerminalSubscribersShape = {
  subscribe(sessionId: string, callback: (data: string) => void): () => void;
  publish(sessionId: string, data: string): void;
  hasSubscribers(sessionId: string): boolean;
};

export class TerminalSubscribers extends ServiceMap.Service<
  TerminalSubscribers,
  TerminalSubscribersShape
>()('@vigie/TerminalSubscribers') {}

export const TerminalSubscribersLayer = Layer.sync(TerminalSubscribers)(() =>
  createTerminalSubscribers()
);
