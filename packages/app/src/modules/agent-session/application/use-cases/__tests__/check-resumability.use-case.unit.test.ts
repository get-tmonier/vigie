import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { EventPublisherShape } from '#modules/agent-session/application/ports/out/event-publisher.port';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import type {
  ResumableSessionInfo,
  SessionRepositoryShape,
} from '#modules/agent-session/application/ports/out/session-repository.port';
import { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import type { DomainEvent } from '#modules/agent-session/domain/events';
import { Session } from '#modules/agent-session/domain/session';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';

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

function makeResumabilityChecker(resumable = false): ResumabilityCheckerShape {
  return {
    isResumable: () => resumable,
  };
}

function makeSessionRepo(sessions: Session[] = []): SessionRepositoryShape & {
  store: Map<string, Session>;
  activeWithAgentId: ResumableSessionInfo[];
  recentlyEnded: ResumableSessionInfo[];
} {
  const store = new Map<string, Session>();
  for (const s of sessions) store.set(s.id, s);

  const activeWithAgentId: ResumableSessionInfo[] = [];
  const recentlyEnded: ResumableSessionInfo[] = [];

  return {
    store,
    activeWithAgentId,
    recentlyEnded,
    findById: (id) => store.get(id) ?? null,
    findAll: () => Array.from(store.values()),
    findActive: () => Array.from(store.values()).filter((s) => s.isActive),
    findActiveWithAgentId: () => activeWithAgentId,
    findRecentlyEnded: () => recentlyEnded,
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

describe('CheckResumabilityUseCase.checkResumableForAll', () => {
  it('updates session and publishes event when resumability changes from false to true', async () => {
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-abc');
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(true),
      eventPublisher,
    });

    useCase.checkResumableForAll();

    await new Promise((r) => setTimeout(r, 10));

    expect(sessionRepo.findById(makeSessionId('sess-1'))?.resumable).toBe(true);
    expect(eventPublisher.published.some((e) => e.type === 'session:resumable-changed')).toBe(true);
  });

  it('does not publish event when resumability is unchanged', async () => {
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-abc');
    // default resumable is false, checker also returns false
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(false),
      eventPublisher,
    });

    useCase.checkResumableForAll();

    await new Promise((r) => setTimeout(r, 10));

    expect(eventPublisher.published.some((e) => e.type === 'session:resumable-changed')).toBe(
      false
    );
  });

  it('skips sessions without agentSessionId', async () => {
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents(); // no agentSessionId set

    const sessionRepo = makeSessionRepo([session]);
    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(true),
      eventPublisher,
    });

    useCase.checkResumableForAll();

    await new Promise((r) => setTimeout(r, 10));

    expect(eventPublisher.published).toHaveLength(0);
  });

  it('events are published (not silently dropped) — forked fiber completes', async () => {
    const session = Session.create({ id: 'sess-fork', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-fork');
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(true),
      eventPublisher,
    });

    useCase.checkResumableForAll();

    // wait for forked fiber to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(eventPublisher.published.length).toBeGreaterThan(0);
  });
});

describe('CheckResumabilityUseCase.checkResumableForActive', () => {
  it('updates active session when resumability changes', async () => {
    const session = Session.create({ id: 'sess-active', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-abc');
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    sessionRepo.activeWithAgentId.push({
      id: makeSessionId('sess-active'),
      agentSessionId: 'agent-abc',
      cwd: '/tmp',
      resumable: false,
    });

    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(true),
      eventPublisher,
    });

    useCase.checkResumableForActive();

    await new Promise((r) => setTimeout(r, 10));

    expect(sessionRepo.findById(makeSessionId('sess-active'))?.resumable).toBe(true);
    expect(eventPublisher.published.some((e) => e.type === 'session:resumable-changed')).toBe(true);
  });

  it('skips active session when resumability is unchanged', async () => {
    const session = Session.create({ id: 'sess-active', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-abc');
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    sessionRepo.activeWithAgentId.push({
      id: makeSessionId('sess-active'),
      agentSessionId: 'agent-abc',
      cwd: '/tmp',
      resumable: false, // matches checker result of false
    });

    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(false),
      eventPublisher,
    });

    useCase.checkResumableForActive();

    await new Promise((r) => setTimeout(r, 10));

    expect(eventPublisher.published.some((e) => e.type === 'session:resumable-changed')).toBe(
      false
    );
  });

  it('updates recently-ended session when resumable', async () => {
    const session = Session.create({ id: 'sess-ended', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-ended');
    session.markEnded(0, false);
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    sessionRepo.recentlyEnded.push({
      id: makeSessionId('sess-ended'),
      agentSessionId: 'agent-ended',
      cwd: '/tmp',
      resumable: false,
    });

    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(true),
      eventPublisher,
    });

    useCase.checkResumableForActive();

    await new Promise((r) => setTimeout(r, 10));

    expect(sessionRepo.findById(makeSessionId('sess-ended'))?.resumable).toBe(true);
    expect(eventPublisher.published.some((e) => e.type === 'session:resumable-changed')).toBe(true);
  });

  it('does not update recently-ended session when checker returns false', async () => {
    const session = Session.create({ id: 'sess-ended', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-ended');
    session.markEnded(0, false);
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    sessionRepo.recentlyEnded.push({
      id: makeSessionId('sess-ended'),
      agentSessionId: 'agent-ended',
      cwd: '/tmp',
      resumable: false,
    });

    const eventPublisher = makeEventPublisher();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(false),
      eventPublisher,
    });

    useCase.checkResumableForActive();

    await new Promise((r) => setTimeout(r, 10));

    expect(eventPublisher.published.some((e) => e.type === 'session:resumable-changed')).toBe(
      false
    );
  });
});
