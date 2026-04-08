import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type {
  ResumableSessionInfo,
  SessionRepositoryShape,
} from '#modules/agent-session/application/ports/out/session-repository.port';
import { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import type { DomainEvent } from '#modules/agent-session/domain/events';
import { Session } from '#modules/agent-session/domain/session';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import type { PtyRegistry } from '#modules/agent-session/infrastructure/pty-registry';

function makeSessionRepo(): SessionRepositoryShape & { store: Map<string, Session> } {
  const store = new Map<string, Session>();
  return {
    store,
    findById: (id) => store.get(id) ?? null,
    findAll: () => Array.from(store.values()),
    findActive: () => Array.from(store.values()).filter((s) => s.isActive),
    findActiveWithAgentId: (): ResumableSessionInfo[] => [],
    findRecentlyEnded: (): ResumableSessionInfo[] => [],
    save: (session) => {
      store.set(session.id, session);
    },
    delete: (id) => {
      store.delete(id);
    },
    deleteAllEnded: () => {
      for (const [k, v] of store) {
        if (v.status === 'ended') store.delete(k);
      }
    },
    markOrphanedEnded: () => {},
    pruneOld: () => {},
  };
}

function makeEventPublisher(): EventPublisherShape & { published: DomainEvent[] } {
  const published: DomainEvent[] = [];
  return {
    published,
    publish: (event) => {
      published.push(event);
      return Effect.void;
    },
    subscribe: (_listener) => () => {},
  };
}

function makeAgentRegistry(canResume = false): AgentRegistryShape {
  return {
    resolve: (_agentType) => ({
      agentType: 'claude',
      canResume,
      detectSessionId: false,
      buildSpawnArgs: () => ({ command: 'claude', args: [] }),
    }),
  };
}

function makeResumabilityChecker(resumable = false): ResumabilityCheckerShape {
  return {
    isResumable: () => resumable,
  };
}

function makePtyRegistry(): PtyRegistry {
  return {
    ptyHandles: new Map(),
    sessionConnections: new Map(),
    connSessions: new Map(),
  };
}

function makeUseCase(overrides?: {
  sessionRepo?: SessionRepositoryShape & { store: Map<string, Session> };
  eventPublisher?: EventPublisherShape & { published: DomainEvent[] };
  agentRegistry?: AgentRegistryShape;
  resumabilityChecker?: ResumabilityCheckerShape;
  registry?: PtyRegistry;
}) {
  const sessionRepo = overrides?.sessionRepo ?? makeSessionRepo();
  const eventPublisher = overrides?.eventPublisher ?? makeEventPublisher();
  return {
    sessionRepo,
    eventPublisher,
    useCase: createSessionLifecycleUseCase({
      sessionRepo,
      resumabilityChecker: overrides?.resumabilityChecker ?? makeResumabilityChecker(),
      agentRegistry: overrides?.agentRegistry ?? makeAgentRegistry(),
      eventPublisher,
      registry: overrides?.registry ?? makePtyRegistry(),
    }),
  };
}

describe('SessionLifecycleUseCase.markEnded', () => {
  it('transitions session to ended', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({ sessionRepo });
    useCase.markEnded('sess-1', 0);

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))?.status).toBe('ended');
  });

  it('sets resumable based on checker when adapter canResume and agentSessionId set', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-abc');
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({
      sessionRepo,
      agentRegistry: makeAgentRegistry(true),
      resumabilityChecker: makeResumabilityChecker(true),
    });
    useCase.markEnded('sess-1', 0);

    await new Promise((r) => setTimeout(r, 10));
    const saved = sessionRepo.findById(makeSessionId('sess-1'));
    expect(saved?.resumable).toBe(true);
  });

  it('is a no-op when session does not exist', () => {
    const { useCase } = makeUseCase();
    expect(() => useCase.markEnded('nonexistent', 0)).not.toThrow();
  });
});

describe('SessionLifecycleUseCase.markError', () => {
  it('transitions session to error', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({ sessionRepo });
    useCase.markError('sess-1', 'crash');

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))?.status).toBe('error');
  });

  it('is a no-op when session does not exist', () => {
    const { useCase } = makeUseCase();
    expect(() => useCase.markError('nonexistent', 'crash')).not.toThrow();
  });
});

describe('SessionLifecycleUseCase.setAgentSessionId', () => {
  it('sets agentSessionId on session', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({ sessionRepo });
    useCase.setAgentSessionId('sess-1', 'agent-xyz');

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))?.agentSessionId).toBe('agent-xyz');
  });

  it('is a no-op when session does not exist', () => {
    const { useCase } = makeUseCase();
    expect(() => useCase.setAgentSessionId('nonexistent', 'agent-xyz')).not.toThrow();
  });
});

describe('SessionLifecycleUseCase.deregister', () => {
  it('marks session ended with exit code 0', async () => {
    const sessionRepo = makeSessionRepo();
    const registry = makePtyRegistry();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);
    registry.sessionConnections.set('sess-1', 'conn-1');
    registry.connSessions.set('conn-1', 'sess-1');

    const { useCase } = makeUseCase({ sessionRepo, registry });
    useCase.deregister('sess-1');

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))?.status).toBe('ended');
  });

  it('cleans up registry connections', () => {
    const sessionRepo = makeSessionRepo();
    const registry = makePtyRegistry();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);
    registry.sessionConnections.set('sess-1', 'conn-1');
    registry.connSessions.set('conn-1', 'sess-1');

    const { useCase } = makeUseCase({ sessionRepo, registry });
    useCase.deregister('sess-1');

    expect(registry.sessionConnections.has('sess-1')).toBe(false);
    expect(registry.connSessions.has('conn-1')).toBe(false);
  });

  it('cleans registry even if session not found', () => {
    const registry = makePtyRegistry();
    registry.sessionConnections.set('sess-orphan', 'conn-orphan');
    registry.connSessions.set('conn-orphan', 'sess-orphan');

    const { useCase } = makeUseCase({ registry });
    useCase.deregister('sess-orphan');

    expect(registry.sessionConnections.has('sess-orphan')).toBe(false);
  });
});
