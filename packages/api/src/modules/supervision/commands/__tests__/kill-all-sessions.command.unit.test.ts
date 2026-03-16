import { afterEach, describe, expect, it } from 'bun:test';
import { Effect, Exit, Layer } from 'effect';
import {
  sessionStore,
  sessionToDaemon,
} from '#modules/supervision/adapters/secondary/shared-state';
import type { AgentSession } from '#modules/supervision/domain/agent-session';
import { DaemonWriteRepository } from '#modules/supervision/ports/daemon-write-repository.port';
import { killAllSessions } from '../kill-all-sessions.command';

const makeSession = (overrides: Partial<AgentSession> & { id: string }): AgentSession => ({
  daemonId: 'daemon-1',
  agentType: 'claude',
  mode: 'prompt',
  cwd: '/tmp',
  startedAt: Date.now(),
  status: 'active',
  ...overrides,
});

describe('killAllSessions', () => {
  afterEach(() => {
    sessionStore.clear();
    sessionToDaemon.clear();
  });

  it('sends session:kill for each active session', async () => {
    const sentMessages: string[] = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        sentMessages.push(data);
      },
    } as unknown as WebSocket;

    const testLayers = Layer.succeed(DaemonWriteRepository, {
      register: () => Effect.die('not implemented'),
      unregister: () => Effect.void,
      getWs: () => Effect.succeed(mockWs),
    });

    const active1 = makeSession({ id: 'a1' });
    const active2 = makeSession({ id: 'a2' });
    const ended = makeSession({ id: 'e1', status: 'ended' });

    for (const s of [active1, active2, ended]) {
      sessionStore.set(s.id, s);
      sessionToDaemon.set(s.id, s.daemonId);
    }

    const result = await Effect.runPromise(Effect.provide(killAllSessions('daemon-1'), testLayers));

    expect(result.killedCount).toBe(2);
    expect(sentMessages).toHaveLength(2);

    const parsed = sentMessages.map((m) => JSON.parse(m));
    for (const msg of parsed) {
      expect(msg.type).toBe('session:kill');
    }
    const killedIds = parsed.map((m) => m.sessionId).sort();
    expect(killedIds).toEqual(['a1', 'a2']);
  });

  it('returns zero when no active sessions exist', async () => {
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: () => {},
    } as unknown as WebSocket;

    const testLayers = Layer.succeed(DaemonWriteRepository, {
      register: () => Effect.die('not implemented'),
      unregister: () => Effect.void,
      getWs: () => Effect.succeed(mockWs),
    });

    const ended = makeSession({ id: 'e1', status: 'ended' });
    sessionStore.set(ended.id, ended);

    const result = await Effect.runPromise(Effect.provide(killAllSessions('daemon-1'), testLayers));

    expect(result.killedCount).toBe(0);
  });

  it('fails with DaemonDisconnectedError when WS is not open', async () => {
    const mockWs = {
      readyState: WebSocket.CLOSED,
      send: () => {},
    } as unknown as WebSocket;

    const testLayers = Layer.succeed(DaemonWriteRepository, {
      register: () => Effect.die('not implemented'),
      unregister: () => Effect.void,
      getWs: () => Effect.succeed(mockWs),
    });

    const exit = await Effect.runPromiseExit(
      Effect.provide(killAllSessions('daemon-1'), testLayers)
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toString();
      expect(error).toContain('DaemonDisconnectedError');
    }
  });

  it('does not kill sessions belonging to other daemons', async () => {
    const sentMessages: string[] = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        sentMessages.push(data);
      },
    } as unknown as WebSocket;

    const testLayers = Layer.succeed(DaemonWriteRepository, {
      register: () => Effect.die('not implemented'),
      unregister: () => Effect.void,
      getWs: () => Effect.succeed(mockWs),
    });

    const ours = makeSession({ id: 'a1', daemonId: 'daemon-1' });
    const theirs = makeSession({ id: 'a2', daemonId: 'daemon-2' });

    for (const s of [ours, theirs]) {
      sessionStore.set(s.id, s);
      sessionToDaemon.set(s.id, s.daemonId);
    }

    const result = await Effect.runPromise(Effect.provide(killAllSessions('daemon-1'), testLayers));

    expect(result.killedCount).toBe(1);
    expect(sentMessages).toHaveLength(1);
    expect(JSON.parse(sentMessages[0]).sessionId).toBe('a1');
  });
});
