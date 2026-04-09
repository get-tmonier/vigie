import { describe, expect, it } from 'bun:test';
import type { AgentCatalogShape } from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { SessionEventBusShape } from '#modules/agent-session/application/ports/out/session-event-bus.port';
import type { SessionStoreShape } from '#modules/agent-session/application/ports/out/session-store.port';
import { createSessionLifecycleUseCase } from '#modules/agent-session/application/use-cases/session-lifecycle.use-case';
import { Session } from '#modules/agent-session/domain/session';
import type { SessionEvent } from '#shared/kernel/session/events';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import { makeSessionEventBus, makeSessionRepo } from './test-helpers';

function makeAgentCatalog(canResume = false, resumable = false): AgentCatalogShape {
  return {
    resolve: (_agentType) => ({
      agentType: 'claude',
      canResume,
      detectSessionId: false,
      buildSpawnArgs: () => ({ command: 'claude', args: [] }),
      isResumable: () => resumable,
    }),
  };
}

function makeUseCase(overrides?: {
  sessionRepo?: SessionStoreShape & { store: Map<string, Session> };
  eventPublisher?: SessionEventBusShape & { published: SessionEvent[] };
  agentCatalog?: AgentCatalogShape;
}) {
  const sessionRepo = overrides?.sessionRepo ?? makeSessionRepo();
  const eventPublisher = overrides?.eventPublisher ?? makeSessionEventBus();
  return {
    sessionRepo,
    eventPublisher,
    useCase: createSessionLifecycleUseCase({
      sessionRepo,
      agentCatalog: overrides?.agentCatalog ?? makeAgentCatalog(),
      eventPublisher,
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
    useCase.markEnded(makeSessionId('sess-1'), 0);

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
      agentCatalog: makeAgentCatalog(true, true),
    });
    useCase.markEnded(makeSessionId('sess-1'), 0);

    await new Promise((r) => setTimeout(r, 10));
    const saved = sessionRepo.findById(makeSessionId('sess-1'));
    expect(saved?.resumable).toBe(true);
  });

  it('is a no-op when session does not exist', () => {
    const { useCase } = makeUseCase();
    expect(() => useCase.markEnded(makeSessionId('nonexistent'), 0)).not.toThrow();
  });
});

describe('SessionLifecycleUseCase.markError', () => {
  it('transitions session to error', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({ sessionRepo });
    useCase.markError(makeSessionId('sess-1'), 'crash');

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))?.status).toBe('error');
  });

  it('is a no-op when session does not exist', () => {
    const { useCase } = makeUseCase();
    expect(() => useCase.markError(makeSessionId('nonexistent'), 'crash')).not.toThrow();
  });
});

describe('SessionLifecycleUseCase.setAgentSessionId', () => {
  it('sets agentSessionId on session', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({ sessionRepo });
    useCase.setAgentSessionId(makeSessionId('sess-1'), 'agent-xyz');

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))?.agentSessionId).toBe('agent-xyz');
  });

  it('is a no-op when session does not exist', () => {
    const { useCase } = makeUseCase();
    expect(() =>
      useCase.setAgentSessionId(makeSessionId('nonexistent'), 'agent-xyz')
    ).not.toThrow();
  });
});

describe('SessionLifecycleUseCase.deregister', () => {
  it('marks session ended with exit code 0', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({ sessionRepo });
    useCase.deregister(makeSessionId('sess-1'));

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))?.status).toBe('ended');
  });

  it('is a no-op when session does not exist', () => {
    const { useCase } = makeUseCase();
    expect(() => useCase.deregister(makeSessionId('nonexistent'))).not.toThrow();
  });

  it('is a no-op when session is already ended', () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.markEnded(0, false);
    session.pullEvents();
    sessionRepo.save(session);

    const { useCase } = makeUseCase({ sessionRepo });
    expect(() => useCase.deregister(makeSessionId('sess-1'))).not.toThrow();
  });
});
