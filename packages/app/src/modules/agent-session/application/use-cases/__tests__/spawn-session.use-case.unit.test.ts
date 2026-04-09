import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { AgentCatalogShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import {
  CannotResumeSessionError,
  SessionNotFoundError,
} from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import type { PtyManagerShape } from '#modules/agent-session/infrastructure/pty-manager.types';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import { makeSessionEventBus, makeSessionRepo } from './test-helpers';

function makeAgentRegistry(canResume = false, detectSessionId = false): AgentCatalogShape {
  return {
    resolve: (_agentType) => ({
      agentType: 'claude',
      canResume,
      detectSessionId,
      buildSpawnArgs: (opts) => ({
        command: 'claude',
        args: opts?.resume ? ['--resume', opts.agentSessionId ?? ''] : [],
      }),
    }),
  };
}

function makePtyManager(): PtyManagerShape & {
  spawnCalls: Array<{ sessionId: string; command: string }>;
  trackedConnections: Map<string, string>;
} {
  const spawnCalls: Array<{ sessionId: string; command: string }> = [];
  const trackedConnections = new Map<string, string>();

  return {
    spawnCalls,
    trackedConnections,
    spawn: (opts) => {
      spawnCalls.push({ sessionId: opts.sessionId, command: opts.command });
      return Effect.succeed({ pid: 1234 });
    },
    kill: () => {},
    killAll: () => {},
    getActivePid: () => null,
    attach: () => null,
    detach: () => {},
    updateCliResize: () => {},
    handleDisconnect: () => {},
    addBrowserChannel: () => null,
    updateBrowserChannel: () => {},
    removeBrowserChannel: () => {},
    writeInput: () => {},
    writeBinaryInput: () => {},
    trackConnection: (sid, connId) => {
      trackedConnections.set(sid, connId);
    },
    getConnId: (sid) => trackedConnections.get(sid),
    clearConnection: (connId) => {
      for (const [k, v] of trackedConnections) {
        if (v === connId) trackedConnections.delete(k);
      }
    },
  };
}

describe('SpawnSessionUseCase.register', () => {
  it('saves session to repository', () => {
    const sessionRepo = makeSessionRepo();
    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeSessionEventBus(),
      ptyManager: makePtyManager(),
    });

    useCase.register({
      sessionId: makeSessionId('sess-1'),
      agentType: 'claude',
      cwd: '/tmp',
      connId: 'conn-1',
    });

    expect(sessionRepo.findById(makeSessionId('sess-1'))).not.toBeNull();
  });

  it('tracks connection via ptyManager', () => {
    const ptyManager = makePtyManager();
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeSessionEventBus(),
      ptyManager,
    });

    useCase.register({
      sessionId: makeSessionId('sess-1'),
      agentType: 'claude',
      cwd: '/tmp',
      connId: 'conn-1',
    });

    expect(ptyManager.trackedConnections.get(makeSessionId('sess-1'))).toBe('conn-1');
  });
});

describe('SpawnSessionUseCase.spawnInteractive', () => {
  it('returns sessionId and pid on success', async () => {
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeSessionEventBus(),
      ptyManager: makePtyManager(),
    });

    const result = await Effect.runPromise(
      useCase.spawnInteractive({
        agentType: 'claude',
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );

    expect(result.pid).toBe(1234);
    expect(result.sessionId).toBeDefined();
  });

  it('sets agentSessionId when detectSessionId is true', async () => {
    const sessionRepo = makeSessionRepo();
    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      agentRegistry: makeAgentRegistry(false, true),
      eventPublisher: makeSessionEventBus(),
      ptyManager: makePtyManager(),
    });

    const result = await Effect.runPromise(
      useCase.spawnInteractive({
        sessionId: makeSessionId('sess-detect'),
        agentType: 'claude',
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );

    const session = sessionRepo.findById(result.sessionId);
    expect(session?.agentSessionId).toBeDefined();
  });

  it('does not set agentSessionId when detectSessionId is false', async () => {
    const sessionRepo = makeSessionRepo();
    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeSessionEventBus(),
      ptyManager: makePtyManager(),
    });

    const result = await Effect.runPromise(
      useCase.spawnInteractive({
        agentType: 'claude',
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );

    const session = sessionRepo.findById(result.sessionId);
    expect(session?.agentSessionId).toBeUndefined();
  });

  it('calls ptyManager.spawn with resolved command', async () => {
    const ptyManager = makePtyManager();
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeSessionEventBus(),
      ptyManager,
    });

    await Effect.runPromise(
      useCase.spawnInteractive({
        agentType: 'claude',
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );

    expect(ptyManager.spawnCalls).toHaveLength(1);
    expect(ptyManager.spawnCalls[0].command).toBe('claude');
  });
});

describe('SpawnSessionUseCase.resume', () => {
  it('fails with SessionNotFoundError when session does not exist', async () => {
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      agentRegistry: makeAgentRegistry(true),
      eventPublisher: makeSessionEventBus(),
      ptyManager: makePtyManager(),
    });

    let caught: unknown = null;
    await Effect.runPromise(
      Effect.catch(useCase.resume(makeSessionId('nonexistent'), { cols: 80, rows: 24 }), (err) => {
        caught = err;
        return Effect.void;
      })
    );
    expect(caught).toBeInstanceOf(SessionNotFoundError);
  });

  it('fails with CannotResumeSessionError when session is not resumable', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.markEnded(0, false);
    session.pullEvents();
    sessionRepo.save(session);

    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      agentRegistry: makeAgentRegistry(true),
      eventPublisher: makeSessionEventBus(),
      ptyManager: makePtyManager(),
    });

    let caught: unknown = null;
    await Effect.runPromise(
      Effect.catch(useCase.resume(makeSessionId('sess-1'), { cols: 80, rows: 24 }), (err) => {
        caught = err;
        return Effect.void;
      })
    );
    expect(caught).toBeInstanceOf(CannotResumeSessionError);
  });

  it('resumes a resumable session and returns pid', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-resume', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-abc');
    session.markEnded(0, true);
    session.pullEvents();
    sessionRepo.save(session);

    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      agentRegistry: makeAgentRegistry(true),
      eventPublisher: makeSessionEventBus(),
      ptyManager: makePtyManager(),
    });

    const result = await Effect.runPromise(
      useCase.resume(makeSessionId('sess-resume'), { cols: 80, rows: 24 })
    );

    expect(result.pid).toBe(1234);
    expect(sessionRepo.findById(makeSessionId('sess-resume'))?.status).toBe('active');
  });
});
