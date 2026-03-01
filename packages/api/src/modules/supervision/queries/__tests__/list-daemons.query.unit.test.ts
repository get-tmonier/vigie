import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { DaemonReadRepository } from '#modules/supervision/ports/daemon-read-repository.port';
import { listDaemons } from '../list-daemons.query';

describe('listDaemons', () => {
  it('returns list from read repository', async () => {
    const mockSessions = [
      { id: '1', hostname: 'host1', pid: 1, version: '0.1.0', connectedAt: Date.now() },
      { id: '2', hostname: 'host2', pid: 2, version: '0.1.0', connectedAt: Date.now() },
    ];

    const testLayer = Layer.succeed(DaemonReadRepository, {
      get: () => Effect.die('not implemented'),
      list: () => Effect.succeed(mockSessions),
    });

    const result = await Effect.runPromise(Effect.provide(listDaemons(), testLayer));
    expect(result).toHaveLength(2);
    expect(result[0].hostname).toBe('host1');
    expect(result[1].hostname).toBe('host2');
  });
});
