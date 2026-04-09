import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { PtySpawnerShape } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import { createSpawnSessionUseCase } from '#modules/agent-session/application/use-cases/spawn-session.use-case';
import {
  CannotResumeSessionError,
  SessionNotFoundError,
} from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import type { PtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';
import { makeDomainEventBus, makeSessionRepo } from './test-helpers';

function makeAgentRegistry(canResume = false, detectSessionId = false): AgentRegistryShape {
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

function makePtySpawner(): PtySpawnerShape {
  return {
    spawn: (_command, _args, _cwd, _cols, _rows) =>
      Effect.succeed({
        pid: 1234,
        write: () => {},
        resize: () => {},
        kill: () => {},
        onOutput: () => {},
        wait: () => Promise.resolve(0),
      }),
  };
}

function makePtyRegistry(): PtyRegistry {
  return {
    ptyHandles: new Map(),
    sessionConnections: new Map(),
    connSessions: new Map(),
  };
}

describe('SpawnSessionUseCase.register', () => {
  it('saves session to repository', () => {
    const sessionRepo = makeSessionRepo();
    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeDomainEventBus(),
      registry: makePtyRegistry(),
      setupPtyLifecycle: () => {},
    });

    useCase.register({
      sessionId: makeSessionId('sess-1'),
      agentType: 'claude',
      cwd: '/tmp',
      connId: 'conn-1',
    });

    expect(sessionRepo.findById(makeSessionId('sess-1'))).not.toBeNull();
  });

  it('maps connId ↔ sessionId in registry', () => {
    const registry = makePtyRegistry();
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeDomainEventBus(),
      registry,
      setupPtyLifecycle: () => {},
    });

    useCase.register({
      sessionId: makeSessionId('sess-1'),
      agentType: 'claude',
      cwd: '/tmp',
      connId: 'conn-1',
    });

    expect(registry.sessionConnections.get(makeSessionId('sess-1'))).toBe('conn-1');
    expect(registry.connSessions.get('conn-1')).toBe(makeSessionId('sess-1'));
  });
});

describe('SpawnSessionUseCase.spawnInteractive', () => {
  it('returns sessionId and pid on success', async () => {
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeDomainEventBus(),
      registry: makePtyRegistry(),
      setupPtyLifecycle: () => {},
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
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(false, true),
      eventPublisher: makeDomainEventBus(),
      registry: makePtyRegistry(),
      setupPtyLifecycle: () => {},
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
    // default makeAgentRegistry has detectSessionId = false
    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeDomainEventBus(),
      registry: makePtyRegistry(),
      setupPtyLifecycle: () => {},
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

  it('registers pty handle in registry', async () => {
    const registry = makePtyRegistry();
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(),
      eventPublisher: makeDomainEventBus(),
      registry,
      setupPtyLifecycle: () => {},
    });

    const result = await Effect.runPromise(
      useCase.spawnInteractive({
        agentType: 'claude',
        cwd: '/tmp',
        cols: 80,
        rows: 24,
      })
    );

    expect(registry.ptyHandles.has(result.sessionId)).toBe(true);
  });
});

describe('SpawnSessionUseCase.resume', () => {
  it('fails with SessionNotFoundError when session does not exist', async () => {
    const useCase = createSpawnSessionUseCase({
      sessionRepo: makeSessionRepo(),
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(true),
      eventPublisher: makeDomainEventBus(),
      registry: makePtyRegistry(),
      setupPtyLifecycle: () => {},
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
    // ended but not resumable (no agentSessionId)
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.markEnded(0, false);
    session.pullEvents();
    sessionRepo.save(session);

    const useCase = createSpawnSessionUseCase({
      sessionRepo,
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(true),
      eventPublisher: makeDomainEventBus(),
      registry: makePtyRegistry(),
      setupPtyLifecycle: () => {},
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
      ptySpawner: makePtySpawner(),
      agentRegistry: makeAgentRegistry(true),
      eventPublisher: makeDomainEventBus(),
      registry: makePtyRegistry(),
      setupPtyLifecycle: () => {},
    });

    const result = await Effect.runPromise(
      useCase.resume(makeSessionId('sess-resume'), { cols: 80, rows: 24 })
    );

    expect(result.pid).toBe(1234);
    expect(sessionRepo.findById(makeSessionId('sess-resume'))?.status).toBe('active');
  });
});
