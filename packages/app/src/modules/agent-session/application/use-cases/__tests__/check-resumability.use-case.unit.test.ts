import { describe, expect, it } from 'bun:test';
import type { ResumabilityCheckerShape } from '#modules/agent-session/application/ports/out/resumability-checker.port';
import { createCheckResumabilityUseCase } from '#modules/agent-session/application/use-cases/check-resumability.use-case';
import { Session } from '#modules/agent-session/domain/session';
import { SessionId as makeSessionId } from '#shared/kernel/session/session-id';
import { makeSessionEventBus, makeSessionRepo } from './test-helpers';

function makeResumabilityChecker(resumable = false): ResumabilityCheckerShape {
  return {
    isResumable: () => resumable,
  };
}

describe('CheckResumabilityUseCase.checkResumableForAll', () => {
  it('updates session and publishes event when resumability changes from false to true', async () => {
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-abc');
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    const eventPublisher = makeSessionEventBus();

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
    const eventPublisher = makeSessionEventBus();

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
    const eventPublisher = makeSessionEventBus();

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
    const eventPublisher = makeSessionEventBus();

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

    const eventPublisher = makeSessionEventBus();

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

    const eventPublisher = makeSessionEventBus();

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

    const eventPublisher = makeSessionEventBus();

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

    const eventPublisher = makeSessionEventBus();

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

  it('passes correct withinMs (5 min) to findRecentlyEnded', async () => {
    let capturedWithinMs: number | undefined;
    const session = Session.create({ id: 'sess-ended', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-ended');
    session.markEnded(0, false);
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    const origFindRecentlyEnded = sessionRepo.findRecentlyEnded.bind(sessionRepo);
    sessionRepo.findRecentlyEnded = (withinMs: number) => {
      capturedWithinMs = withinMs;
      return origFindRecentlyEnded(withinMs);
    };

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(false),
      eventPublisher: makeSessionEventBus(),
    });

    useCase.checkResumableForActive();

    await new Promise((r) => setTimeout(r, 10));

    expect(capturedWithinMs).toBe(5 * 60 * 1000);
  });

  it('does not publish event when recently-ended session already has resumable = true', async () => {
    const session = Session.create({ id: 'sess-ended', agentType: 'claude', cwd: '/tmp' });
    session.setAgentSessionId('agent-ended');
    session.markEnded(0, true); // already resumable
    session.pullEvents();

    const sessionRepo = makeSessionRepo([session]);
    sessionRepo.recentlyEnded.push({
      id: makeSessionId('sess-ended'),
      agentSessionId: 'agent-ended',
      cwd: '/tmp',
      resumable: true,
    });

    const eventPublisher = makeSessionEventBus();

    const useCase = createCheckResumabilityUseCase({
      sessionRepo,
      resumabilityChecker: makeResumabilityChecker(true),
      eventPublisher,
    });

    useCase.checkResumableForActive();

    await new Promise((r) => setTimeout(r, 10));

    expect(eventPublisher.published.some((e) => e.type === 'session:resumable-changed')).toBe(
      false
    );
  });
});
