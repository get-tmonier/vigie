import { describe, expect, it } from 'bun:test';
import type { SessionStarted } from '@tmonier/shared';
import { createAgentSession } from '../agent-session';

const baseMsg: SessionStarted = {
  type: 'session:started',
  sessionId: 'session-123',
  agentType: 'claude',
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
});
