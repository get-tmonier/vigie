import { describe, expect, it } from 'bun:test';
import type { SessionStarted } from '@tmonier/shared';
import { createAgentSession } from '../agent-session';

const baseMsg: SessionStarted = {
  type: 'session:started',
  sessionId: 'session-123',
  agentType: 'claude',
  mode: 'prompt',
  cwd: '/home/user/project',
  timestamp: 1_000_000,
};

describe('createAgentSession', () => {
  it('maps SessionStarted fields correctly', () => {
    const msg: SessionStarted = {
      ...baseMsg,
      gitBranch: 'main',
      repoName: 'my-repo',
    };
    const session = createAgentSession('daemon-abc', msg);

    expect(session.id).toBe('session-123');
    expect(session.daemonId).toBe('daemon-abc');
    expect(session.agentType).toBe('claude');
    expect(session.cwd).toBe('/home/user/project');
    expect(session.gitBranch).toBe('main');
    expect(session.repoName).toBe('my-repo');
    expect(session.startedAt).toBe(1_000_000);
  });

  it('status is active on creation', () => {
    const session = createAgentSession('daemon-abc', baseMsg);
    expect(session.status).toBe('active');
  });

  it('optional fields are omitted when not in message', () => {
    const session = createAgentSession('daemon-abc', baseMsg);
    expect(session.gitBranch).toBeUndefined();
    expect(session.repoName).toBeUndefined();
  });

  it('does not set resumable — callers must carry it forward from existing session on resume', () => {
    // createAgentSession intentionally omits resumable so the daemon-ws session:started
    // handler can spread the existing session's resumable on top. If resumable were set
    // here it would require the SessionStarted message to always carry it, which it does not.
    const session = createAgentSession('daemon-abc', baseMsg);
    expect(session.resumable).toBeUndefined();
  });

  it('carry-forward pattern preserves resumable from ended session on resume', () => {
    // This replicates the spread logic in the session:started WS handler.
    const freshSession = createAgentSession('daemon-abc', baseMsg);
    const existingEndedSession = { ...freshSession, status: 'ended' as const, resumable: true };

    const merged = {
      ...freshSession,
      ...(existingEndedSession.resumable !== undefined && {
        resumable: existingEndedSession.resumable,
      }),
    };

    expect(merged.resumable).toBe(true);
    expect(merged.status).toBe('active');
  });

  it('carry-forward is skipped when there is no existing session (fresh start)', () => {
    // When sessionStore.get() returns undefined (brand new session), no carry-forward happens.
    // The fresh session has no resumable, so the merged result has no resumable either.
    const freshSession = createAgentSession('daemon-abc', baseMsg);
    expect(freshSession.resumable).toBeUndefined();
  });
});
