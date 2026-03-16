import { afterEach, describe, expect, it } from 'bun:test';
import { Effect, Exit } from 'effect';
import {
  sessionStore,
  sessionToDaemon,
} from '#modules/supervision/adapters/secondary/shared-state';
import type { AgentSession } from '#modules/supervision/domain/agent-session';
import { deleteSession } from '../delete-session.command';

const makeSession = (overrides: Partial<AgentSession> = {}): AgentSession => ({
  id: 'sess-1',
  daemonId: 'daemon-1',
  agentType: 'claude',
  mode: 'prompt',
  cwd: '/tmp',
  startedAt: Date.now(),
  status: 'ended',
  ...overrides,
});

describe('deleteSession', () => {
  afterEach(() => {
    sessionStore.clear();
    sessionToDaemon.clear();
  });

  it('deletes an ended session from both stores', async () => {
    const session = makeSession();
    sessionStore.set(session.id, session);
    sessionToDaemon.set(session.id, session.daemonId);

    await Effect.runPromise(deleteSession('sess-1'));

    expect(sessionStore.has('sess-1')).toBe(false);
    expect(sessionToDaemon.has('sess-1')).toBe(false);
  });

  it('fails with SessionNotFoundError when session does not exist', async () => {
    const exit = await Effect.runPromiseExit(deleteSession('nonexistent'));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toString();
      expect(error).toContain('SessionNotFoundError');
    }
  });

  it('fails with SessionStillActiveError when session is active', async () => {
    const session = makeSession({ status: 'active' });
    sessionStore.set(session.id, session);

    const exit = await Effect.runPromiseExit(deleteSession('sess-1'));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toString();
      expect(error).toContain('SessionStillActiveError');
    }
  });
});
