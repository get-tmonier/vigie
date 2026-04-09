import { describe, expect, it } from 'bun:test';
import { createSessionCleanupUseCase } from '#modules/agent-session/application/use-cases/session-cleanup.use-case';
import { CannotDeleteActiveSessionError } from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import { makeSessionEventBus, makeSessionRepo } from './test-helpers';

describe('SessionCleanupUseCase.delete', () => {
  it('removes an ended session from the repository', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.markEnded(0, false);
    session.pullEvents();
    sessionRepo.save(session);

    const useCase = createSessionCleanupUseCase({
      sessionRepo,
      eventPublisher: makeSessionEventBus(),
    });
    useCase.delete(makeSessionId('sess-1'));

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))).toBeNull();
  });

  it('removes an error session from the repository', async () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.markError('crash');
    session.pullEvents();
    sessionRepo.save(session);

    const useCase = createSessionCleanupUseCase({
      sessionRepo,
      eventPublisher: makeSessionEventBus(),
    });
    useCase.delete(makeSessionId('sess-1'));

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))).toBeNull();
  });

  it('publishes session:deleted event', async () => {
    const sessionRepo = makeSessionRepo();
    const eventPublisher = makeSessionEventBus();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.markEnded(0, false);
    session.pullEvents();
    sessionRepo.save(session);

    const useCase = createSessionCleanupUseCase({ sessionRepo, eventPublisher });
    useCase.delete(makeSessionId('sess-1'));

    await new Promise((r) => setTimeout(r, 10));
    expect(eventPublisher.published.some((e) => e.type === 'session:deleted')).toBe(true);
  });

  it('is a no-op when session does not exist', () => {
    const sessionRepo = makeSessionRepo();
    const useCase = createSessionCleanupUseCase({
      sessionRepo,
      eventPublisher: makeSessionEventBus(),
    });
    expect(() => useCase.delete(makeSessionId('nonexistent'))).not.toThrow();
  });

  it('throws when trying to delete an active session', () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-active', agentType: 'claude', cwd: '/tmp' });
    session.pullEvents();
    sessionRepo.save(session);

    const useCase = createSessionCleanupUseCase({
      sessionRepo,
      eventPublisher: makeSessionEventBus(),
    });
    expect(() => useCase.delete(makeSessionId('sess-active'))).toThrow(
      CannotDeleteActiveSessionError
    );
  });
});

describe('SessionCleanupUseCase.deleteAllEnded', () => {
  it('removes all ended sessions from the repository', async () => {
    const sessionRepo = makeSessionRepo();

    const s1 = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    s1.markEnded(0, false);
    s1.pullEvents();
    sessionRepo.save(s1);

    const s2 = Session.create({ id: 'sess-2', agentType: 'claude', cwd: '/tmp' });
    s2.markEnded(1, false);
    s2.pullEvents();
    sessionRepo.save(s2);

    const s3 = Session.create({ id: 'sess-3', agentType: 'claude', cwd: '/tmp' });
    s3.pullEvents();
    sessionRepo.save(s3); // active session — should remain

    const useCase = createSessionCleanupUseCase({
      sessionRepo,
      eventPublisher: makeSessionEventBus(),
    });
    useCase.deleteAllEnded();

    await new Promise((r) => setTimeout(r, 10));
    expect(sessionRepo.findById(makeSessionId('sess-1'))).toBeNull();
    expect(sessionRepo.findById(makeSessionId('sess-2'))).toBeNull();
    expect(sessionRepo.findById(makeSessionId('sess-3'))).not.toBeNull();
  });

  it('publishes sessions:cleared event', async () => {
    const sessionRepo = makeSessionRepo();
    const eventPublisher = makeSessionEventBus();

    const useCase = createSessionCleanupUseCase({ sessionRepo, eventPublisher });
    useCase.deleteAllEnded();

    await new Promise((r) => setTimeout(r, 10));
    expect(eventPublisher.published.some((e) => e.type === 'sessions:cleared')).toBe(true);
  });
});
