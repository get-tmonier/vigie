import { afterEach, describe, expect, it } from 'bun:test';
import type { CommandOutput, SSEEvent } from '@tmonier/shared';
import { Effect, Layer } from 'effect';
import { InMemoryDaemonReadRepositoryLive } from '#modules/supervision/adapters/secondary/in-memory-daemon-read-repository';
import { InMemoryDaemonWriteRepositoryLive } from '#modules/supervision/adapters/secondary/in-memory-daemon-write-repository';
import { InMemoryEventPublisherLive } from '#modules/supervision/adapters/secondary/in-memory-event-publisher';
import { DaemonWriteRepository } from '#modules/supervision/ports/daemon-write-repository.port';
import { EventPublisher } from '#modules/supervision/ports/event-publisher.port';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive
);

const run = <A, E>(effect: Effect.Effect<A, E, DaemonWriteRepository | EventPublisher>) =>
  Effect.runPromise(Effect.provide(effect, allLayers));

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const unsub of cleanups.splice(0)) unsub();
});

describe('WS → EventPublisher relay', () => {
  it('publishes command:output to subscribers after daemon registration', async () => {
    const received: SSEEvent[] = [];

    await run(
      Effect.gen(function* () {
        const writeRepo = yield* Effect.service(DaemonWriteRepository);
        const publisher = yield* Effect.service(EventPublisher);

        const session = {
          id: 'd-relay-1',
          hostname: 'test-host',
          pid: 1234,
          version: '0.1.0',
          userId: 'user-1',
          connectedAt: Date.now(),
        };

        const mockWs = {} as WebSocket;
        yield* writeRepo.register(session, mockWs);

        const unsub = yield* publisher.subscribe('d-relay-1', (event) => {
          received.push(event);
        });
        cleanups.push(unsub);

        const commandOutput: CommandOutput = {
          type: 'command:output',
          id: 'cmd-1',
          stream: 'stdout',
          data: 'hello world\n',
          timestamp: Date.now(),
        };

        yield* publisher.publish('d-relay-1', commandOutput);
      })
    );

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('command:output');
    expect((received[0] as CommandOutput).data).toBe('hello world\n');
  });
});
