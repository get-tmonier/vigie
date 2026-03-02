import { afterEach, describe, expect, it } from 'bun:test';
import type { SSEDaemonConnected, SSEDaemonDisconnected } from '@tmonier/shared';
import { Effect } from 'effect';
import { EventPublisher } from '#modules/supervision/ports/event-publisher.port';
import { InMemoryEventPublisherLive } from '../in-memory-event-publisher';

const run = <A, E>(effect: Effect.Effect<A, E, EventPublisher>) =>
  Effect.runPromise(Effect.provide(effect, InMemoryEventPublisherLive));

const connected = (daemonId: string): SSEDaemonConnected => ({
  type: 'daemon:connected',
  daemonId,
  hostname: 'host',
  timestamp: Date.now(),
});

const disconnected = (daemonId: string): SSEDaemonDisconnected => ({
  type: 'daemon:disconnected',
  daemonId,
  hostname: 'host',
  timestamp: Date.now(),
});

// Tracks active unsubscribe fns to clean up leaked subscribers between tests
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const unsub of cleanups.splice(0)) unsub();
});

describe('InMemoryEventPublisher', () => {
  describe('subscribe + publish', () => {
    it('delivers a published event to a subscriber', async () => {
      const received: SSEDaemonConnected[] = [];
      await run(
        Effect.gen(function* () {
          const publisher = yield* Effect.service(EventPublisher);
          const unsub = yield* publisher.subscribe('d-1', (e) =>
            received.push(e as SSEDaemonConnected)
          );
          cleanups.push(unsub);
          const event = connected('d-1');
          yield* publisher.publish('d-1', event);
          expect(received).toHaveLength(1);
          expect(received[0]).toEqual(event);
          unsub();
        })
      );
    });

    it('delivers multiple events in order', async () => {
      const received: Array<SSEDaemonConnected | SSEDaemonDisconnected> = [];
      await run(
        Effect.gen(function* () {
          const publisher = yield* Effect.service(EventPublisher);
          const unsub = yield* publisher.subscribe('d-2', (e) => {
            received.push(e as SSEDaemonConnected | SSEDaemonDisconnected);
          });
          cleanups.push(unsub);
          yield* publisher.publish('d-2', connected('d-2'));
          yield* publisher.publish('d-2', disconnected('d-2'));
          expect(received).toHaveLength(2);
          expect(received[0]?.type).toBe('daemon:connected');
          expect(received[1]?.type).toBe('daemon:disconnected');
          unsub();
        })
      );
    });

    it('does not deliver events to subscribers of a different daemonId', async () => {
      const received: SSEDaemonConnected[] = [];
      await run(
        Effect.gen(function* () {
          const publisher = yield* Effect.service(EventPublisher);
          const unsub = yield* publisher.subscribe('d-A', (e) =>
            received.push(e as SSEDaemonConnected)
          );
          cleanups.push(unsub);
          yield* publisher.publish('d-B', connected('d-B'));
          expect(received).toHaveLength(0);
          unsub();
        })
      );
    });

    it('delivers to all subscribers for the same daemonId', async () => {
      const r1: SSEDaemonConnected[] = [];
      const r2: SSEDaemonConnected[] = [];
      await run(
        Effect.gen(function* () {
          const publisher = yield* Effect.service(EventPublisher);
          const u1 = yield* publisher.subscribe('d-3', (e) => r1.push(e as SSEDaemonConnected));
          const u2 = yield* publisher.subscribe('d-3', (e) => r2.push(e as SSEDaemonConnected));
          cleanups.push(u1, u2);
          yield* publisher.publish('d-3', connected('d-3'));
          expect(r1).toHaveLength(1);
          expect(r2).toHaveLength(1);
          u1();
          u2();
        })
      );
    });
  });

  describe('unsubscribe', () => {
    it('stops delivering events after unsubscribe', async () => {
      const received: SSEDaemonConnected[] = [];
      await run(
        Effect.gen(function* () {
          const publisher = yield* Effect.service(EventPublisher);
          const unsub = yield* publisher.subscribe('d-4', (e) =>
            received.push(e as SSEDaemonConnected)
          );
          yield* publisher.publish('d-4', connected('d-4'));
          unsub();
          yield* publisher.publish('d-4', connected('d-4'));
          expect(received).toHaveLength(1);
        })
      );
    });
  });

  describe('publish with no subscribers', () => {
    it('does not throw when no subscriber is registered', async () => {
      await expect(
        run(
          Effect.gen(function* () {
            const publisher = yield* Effect.service(EventPublisher);
            yield* publisher.publish('d-nobody', connected('d-nobody'));
          })
        )
      ).resolves.toBeUndefined();
    });
  });
});
