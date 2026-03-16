import { afterEach, describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import {
  sessionStore,
  sessionToDaemon,
} from '#modules/supervision/adapters/secondary/shared-state';
import type { AgentSession } from '#modules/supervision/domain/agent-session';
import { clearEndedSessions } from '../clear-ended-sessions.command';

const makeSession = (overrides: Partial<AgentSession> & { id: string }): AgentSession => ({
  daemonId: 'daemon-1',
  agentType: 'claude',
  mode: 'prompt',
  cwd: '/tmp',
  startedAt: Date.now(),
  status: 'ended',
  ...overrides,
});

describe('clearEndedSessions', () => {
  afterEach(() => {
    sessionStore.clear();
    sessionToDaemon.clear();
  });

  it('deletes all ended sessions for a daemon', async () => {
    const ended1 = makeSession({ id: 'e1' });
    const ended2 = makeSession({ id: 'e2' });
    const active = makeSession({ id: 'a1', status: 'active' });

    for (const s of [ended1, ended2, active]) {
      sessionStore.set(s.id, s);
      sessionToDaemon.set(s.id, s.daemonId);
    }

    const result = await Effect.runPromise(clearEndedSessions('daemon-1'));

    expect(result.deletedCount).toBe(2);
    expect(sessionStore.has('e1')).toBe(false);
    expect(sessionStore.has('e2')).toBe(false);
    expect(sessionStore.has('a1')).toBe(true);
    expect(sessionToDaemon.has('a1')).toBe(true);
  });

  it('does not delete sessions belonging to other daemons', async () => {
    const ours = makeSession({ id: 's1', daemonId: 'daemon-1' });
    const theirs = makeSession({ id: 's2', daemonId: 'daemon-2' });

    for (const s of [ours, theirs]) {
      sessionStore.set(s.id, s);
      sessionToDaemon.set(s.id, s.daemonId);
    }

    const result = await Effect.runPromise(clearEndedSessions('daemon-1'));

    expect(result.deletedCount).toBe(1);
    expect(sessionStore.has('s1')).toBe(false);
    expect(sessionStore.has('s2')).toBe(true);
  });

  it('returns zero when no ended sessions exist', async () => {
    const active = makeSession({ id: 'a1', status: 'active' });
    sessionStore.set(active.id, active);

    const result = await Effect.runPromise(clearEndedSessions('daemon-1'));

    expect(result.deletedCount).toBe(0);
    expect(sessionStore.has('a1')).toBe(true);
  });
});
