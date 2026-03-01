import { describe, expect, it } from 'bun:test';
import type { SSEEvent } from '@tmonier/shared';
import { Effect, Layer } from 'effect';
import { DaemonWriteRepository } from '../../ports/daemon-write-repository.port.js';
import { EventPublisher } from '../../ports/event-publisher.port.js';
import { registerDaemon } from '../register-daemon.command.js';

describe('registerDaemon', () => {
  it('registers a daemon and publishes connected event', async () => {
    const published: SSEEvent[] = [];
    let registered = false;

    const testLayers = Layer.mergeAll(
      Layer.succeed(DaemonWriteRepository, {
        register: (session, _ws) =>
          Effect.sync(() => {
            registered = true;
            return session;
          }),
        unregister: () => Effect.void,
        getWs: () => Effect.die('not implemented'),
      }),
      Layer.succeed(EventPublisher, {
        publish: (_daemonId, event) =>
          Effect.sync(() => {
            published.push(event);
          }),
        subscribe: () => Effect.succeed(() => {}),
      })
    );

    const hello = {
      type: 'daemon:hello' as const,
      hostname: 'test-host',
      pid: 42,
      version: '0.1.0',
    };
    const mockWs = {} as WebSocket;

    const session = await Effect.runPromise(
      Effect.provide(registerDaemon(hello, mockWs), testLayers)
    );

    expect(registered).toBe(true);
    expect(session.hostname).toBe('test-host');
    expect(session.pid).toBe(42);
    expect(published).toHaveLength(1);
    expect(published[0].type).toBe('daemon:connected');
  });
});
