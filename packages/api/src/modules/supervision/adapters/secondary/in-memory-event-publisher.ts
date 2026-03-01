import type { SSEEvent } from '@tmonier/shared';
import { Effect, Layer } from 'effect';
import { EventPublisher } from '../../ports/event-publisher.port.js';

const subscribers = new Map<string, Set<(event: SSEEvent) => void>>();

export const InMemoryEventPublisherLive = Layer.succeed(EventPublisher, {
  publish: (daemonId, event) =>
    Effect.sync(() => {
      const subs = subscribers.get(daemonId);
      if (subs) {
        for (const cb of subs) {
          cb(event);
        }
      }
    }),
  subscribe: (daemonId, callback) =>
    Effect.sync(() => {
      let subs = subscribers.get(daemonId);
      if (!subs) {
        subs = new Set();
        subscribers.set(daemonId, subs);
      }
      subs.add(callback);
      return () => {
        subs.delete(callback);
        if (subs.size === 0) {
          subscribers.delete(daemonId);
        }
      };
    }),
});
