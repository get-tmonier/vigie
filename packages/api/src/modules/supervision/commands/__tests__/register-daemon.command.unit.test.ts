import { describe, expect, it } from 'bun:test';
import type { SSEEvent } from '@vigie/shared';
import { Effect, Layer } from 'effect';
import { deriveDaemonId } from '#modules/supervision/domain/daemon-session';
import { DaemonWriteRepository } from '#modules/supervision/ports/daemon-write-repository.port';
import { EventPublisher } from '#modules/supervision/ports/event-publisher.port';
import { registerDaemon } from '../register-daemon.command';

describe('registerDaemon', () => {
  const hello = {
    type: 'daemon:hello' as const,
    hostname: 'test-host',
    pid: 42,
    version: '0.1.0',
  };
  const mockWs = {} as WebSocket;

  it('registers a daemon with deterministic ID and publishes connected event', async () => {
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

    const session = await Effect.runPromise(
      Effect.provide(registerDaemon(hello, mockWs, 'user-1'), testLayers)
    );

    expect(registered).toBe(true);
    expect(session.id).toBe(deriveDaemonId('user-1', 'test-host'));
    expect(session.hostname).toBe('test-host');
    expect(session.pid).toBe(42);
    expect(session.userId).toBe('user-1');
    expect(published).toHaveLength(1);
    expect(published[0].type).toBe('daemon:connected');
  });

  it('unregisters existing session before re-registering (reconnect-replace)', async () => {
    const unregistered: string[] = [];

    const testLayers = Layer.mergeAll(
      Layer.succeed(DaemonWriteRepository, {
        register: (session, _ws) => Effect.succeed(session),
        unregister: (id) =>
          Effect.sync(() => {
            unregistered.push(id);
          }),
        getWs: () => Effect.die('not implemented'),
      }),
      Layer.succeed(EventPublisher, {
        publish: () => Effect.void,
        subscribe: () => Effect.succeed(() => {}),
      })
    );

    const expectedId = deriveDaemonId('user-1', 'test-host');
    await Effect.runPromise(Effect.provide(registerDaemon(hello, mockWs, 'user-1'), testLayers));

    expect(unregistered).toHaveLength(1);
    expect(unregistered[0]).toBe(expectedId);
  });
});
