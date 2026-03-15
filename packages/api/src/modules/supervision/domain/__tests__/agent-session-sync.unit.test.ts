import { describe, expect, it } from 'bun:test';
import type { DaemonSyncSession } from '@tmonier/shared';
import { createAgentSessionFromSync } from '../agent-session';

const baseSyncSession: DaemonSyncSession = {
  sessionId: 'sync-session-1',
  agentType: 'claude',
  mode: 'interactive',
  cwd: '/home/user/project',
  startedAt: 2_000_000,
  status: 'active',
  terminalChunks: [],
};

describe('createAgentSessionFromSync', () => {
  it('maps sync session fields correctly', () => {
    const session = createAgentSessionFromSync('daemon-xyz', {
      ...baseSyncSession,
      gitBranch: 'feat/test',
      repoName: 'my-repo',
    });

    expect(session.id).toBe('sync-session-1');
    expect(session.daemonId).toBe('daemon-xyz');
    expect(session.agentType).toBe('claude');
    expect(session.mode).toBe('interactive');
    expect(session.cwd).toBe('/home/user/project');
    expect(session.gitBranch).toBe('feat/test');
    expect(session.repoName).toBe('my-repo');
    expect(session.startedAt).toBe(2_000_000);
  });

  it('status is active for active sync session', () => {
    const session = createAgentSessionFromSync('daemon-xyz', baseSyncSession);
    expect(session.status).toBe('active');
  });

  it('maps ended status correctly', () => {
    const session = createAgentSessionFromSync('daemon-xyz', {
      ...baseSyncSession,
      status: 'ended',
      exitCode: 0,
    });
    expect(session.status).toBe('ended');
  });

  it('maps error status to ended', () => {
    const session = createAgentSessionFromSync('daemon-xyz', {
      ...baseSyncSession,
      status: 'error',
      exitCode: -1,
    });
    expect(session.status).toBe('ended');
  });

  it('defaults mode to prompt when set to prompt', () => {
    const session = createAgentSessionFromSync('daemon-xyz', {
      ...baseSyncSession,
      mode: 'prompt',
    });
    expect(session.mode).toBe('prompt');
  });

  it('optional fields are omitted when not in sync data', () => {
    const session = createAgentSessionFromSync('daemon-xyz', baseSyncSession);
    expect(session.gitBranch).toBeUndefined();
    expect(session.repoName).toBeUndefined();
  });
});
