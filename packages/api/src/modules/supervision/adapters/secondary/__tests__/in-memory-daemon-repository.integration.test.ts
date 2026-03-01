import { afterEach, describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { createDaemonSession } from '../../../domain/daemon-session.js';
import { DaemonReadRepository } from '../../../ports/daemon-read-repository.port.js';
import { DaemonWriteRepository } from '../../../ports/daemon-write-repository.port.js';
import { DaemonNotFoundError } from '../../../ports/errors.js';
import { InMemoryDaemonReadRepositoryLive } from '../in-memory-daemon-read-repository.js';
import { InMemoryDaemonWriteRepositoryLive } from '../in-memory-daemon-write-repository.js';
import { daemonStore } from '../shared-state.js';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive
);

const run = <A, E>(effect: Effect.Effect<A, E, DaemonWriteRepository | DaemonReadRepository>) =>
  Effect.runPromise(Effect.provide(effect, allLayers));

const makeHello = (overrides: { hostname?: string; pid?: number } = {}) => ({
  type: 'daemon:hello' as const,
  hostname: overrides.hostname ?? 'test-host',
  pid: overrides.pid ?? 1234,
  version: '1.0.0',
});

const makeMockWs = () => ({}) as WebSocket;

afterEach(() => {
  daemonStore.clear();
});

describe('InMemoryDaemonWriteRepository + InMemoryDaemonReadRepository', () => {
  describe('register + get', () => {
    it('retrieves the registered session by id', async () => {
      const session = createDaemonSession(makeHello());
      await run(
        Effect.gen(function* () {
          const write = yield* Effect.service(DaemonWriteRepository);
          const read = yield* Effect.service(DaemonReadRepository);
          yield* write.register(session, makeMockWs());
          const found = yield* read.get(session.id);
          expect(found.id).toBe(session.id);
          expect(found.hostname).toBe('test-host');
          expect(found.pid).toBe(1234);
        })
      );
    });

    it('returns DaemonNotFoundError for unknown id', async () => {
      const error = await Effect.runPromise(
        Effect.provide(
          Effect.flip(
            Effect.gen(function* () {
              const read = yield* Effect.service(DaemonReadRepository);
              return yield* read.get('ghost');
            })
          ),
          allLayers
        )
      );
      expect(error).toBeInstanceOf(DaemonNotFoundError);
      expect((error as DaemonNotFoundError).id).toBe('ghost');
    });
  });

  describe('list', () => {
    it('returns empty array when store is empty', async () => {
      const sessions = await run(
        Effect.gen(function* () {
          const read = yield* Effect.service(DaemonReadRepository);
          return yield* read.list();
        })
      );
      expect(sessions).toEqual([]);
    });

    it('returns all registered sessions', async () => {
      const s1 = createDaemonSession(makeHello({ hostname: 'host-1', pid: 1 }));
      const s2 = createDaemonSession(makeHello({ hostname: 'host-2', pid: 2 }));
      const sessions = await run(
        Effect.gen(function* () {
          const write = yield* Effect.service(DaemonWriteRepository);
          const read = yield* Effect.service(DaemonReadRepository);
          yield* write.register(s1, makeMockWs());
          yield* write.register(s2, makeMockWs());
          return yield* read.list();
        })
      );
      expect(sessions).toHaveLength(2);
      const hostnames = sessions.map((s) => s.hostname).sort();
      expect(hostnames).toEqual(['host-1', 'host-2']);
    });
  });

  describe('unregister', () => {
    it('removes the session from the store', async () => {
      const session = createDaemonSession(makeHello());
      await run(
        Effect.gen(function* () {
          const write = yield* Effect.service(DaemonWriteRepository);
          const read = yield* Effect.service(DaemonReadRepository);
          yield* write.register(session, makeMockWs());
          yield* write.unregister(session.id);
          const sessions = yield* read.list();
          expect(sessions).toHaveLength(0);
        })
      );
    });

    it('makes get return DaemonNotFoundError after unregister', async () => {
      const session = createDaemonSession(makeHello());
      const error = await Effect.runPromise(
        Effect.provide(
          Effect.gen(function* () {
            const write = yield* Effect.service(DaemonWriteRepository);
            yield* write.register(session, makeMockWs());
            yield* write.unregister(session.id);
            const read = yield* Effect.service(DaemonReadRepository);
            return yield* Effect.flip(read.get(session.id));
          }),
          allLayers
        )
      );
      expect(error).toBeInstanceOf(DaemonNotFoundError);
    });
  });

  describe('getWs', () => {
    it('returns the exact WebSocket reference passed at registration', async () => {
      const session = createDaemonSession(makeHello());
      const ws = makeMockWs();
      await run(
        Effect.gen(function* () {
          const write = yield* Effect.service(DaemonWriteRepository);
          yield* write.register(session, ws);
          const retrieved = yield* write.getWs(session.id);
          expect(retrieved).toBe(ws);
        })
      );
    });

    it('returns DaemonNotFoundError for unregistered id', async () => {
      const error = await Effect.runPromise(
        Effect.provide(
          Effect.flip(
            Effect.gen(function* () {
              const write = yield* Effect.service(DaemonWriteRepository);
              return yield* write.getWs('ghost');
            })
          ),
          allLayers
        )
      );
      expect(error).toBeInstanceOf(DaemonNotFoundError);
    });
  });
});
