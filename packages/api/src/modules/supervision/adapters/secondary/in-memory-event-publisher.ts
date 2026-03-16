import type { SSEEvent } from '@tmonier/shared';
import { Effect, Layer } from 'effect';
import { EventPublisher } from '#modules/supervision/ports/event-publisher.port';

const subscribers = new Map<string, Set<(event: SSEEvent) => void>>();

export const InMemoryEventPublisherLive = Layer.succeed(EventPublisher, {
  publish: (daemonId, event) =>
    Effect.gen(function* () {
      const subs = subscribers.get(daemonId);
      if (subs) {
        for (const cb of subs) {
          cb(event);
        }
      }
      yield* Effect.annotateLogs(Effect.logDebug('EventPublisher: publishing'), {
        daemonId,
        eventType: event.type,
        subscriberCount: subs?.size ?? 0,
      });
    }),
  subscribe: (daemonId, callback) =>
    Effect.gen(function* () {
      let subs = subscribers.get(daemonId);
      if (!subs) {
        subs = new Set();
        subscribers.set(daemonId, subs);
      }
      subs.add(callback);
      yield* Effect.annotateLogs(Effect.logDebug('EventPublisher: subscriber added'), {
        daemonId,
        subscriberCount: subs.size,
      });
      return () => {
        subs.delete(callback);
        if (subs.size === 0) {
          subscribers.delete(daemonId);
        }
      };
    }),
});
