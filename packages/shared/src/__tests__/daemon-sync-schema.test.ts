import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  DaemonSyncSchema,
  DaemonSyncSessionSchema,
  UpstreamMessageSchema,
} from '../schemas/daemon';

describe('DaemonSyncSessionSchema', () => {
  it('parses a full session with all fields', () => {
    const session = v.parse(DaemonSyncSessionSchema, {
      sessionId: 's-1',
      agentType: 'claude',
      mode: 'interactive',
      cwd: '/home/user',
      gitBranch: 'main',
      repoName: 'my-repo',
      startedAt: 1000,
      status: 'active',
      exitCode: undefined,
      terminalChunks: [
        { data: 'aGVsbG8=', timestamp: 100, seq: 1 },
        { data: 'd29ybGQ=', timestamp: 200, seq: 2 },
      ],
    });
    expect(session.sessionId).toBe('s-1');
    expect(session.agentType).toBe('claude');
    expect(session.mode).toBe('interactive');
    expect(session.terminalChunks).toHaveLength(2);
  });

  it('defaults mode to prompt', () => {
    const session = v.parse(DaemonSyncSessionSchema, {
      sessionId: 's-1',
      agentType: 'opencode',
      cwd: '/tmp',
      startedAt: 0,
      status: 'ended',
      exitCode: 0,
      terminalChunks: [],
    });
    expect(session.mode).toBe('prompt');
  });

  it('accepts all status values', () => {
    for (const status of ['active', 'ended', 'error'] as const) {
      const session = v.parse(DaemonSyncSessionSchema, {
        sessionId: 's-1',
        agentType: 'generic',
        cwd: '/',
        startedAt: 0,
        status,
        terminalChunks: [],
      });
      expect(session.status).toBe(status);
    }
  });

  it('rejects invalid agentType', () => {
    expect(() =>
      v.parse(DaemonSyncSessionSchema, {
        sessionId: 's-1',
        agentType: 'unknown-agent',
        cwd: '/',
        startedAt: 0,
        status: 'active',
        terminalChunks: [],
      })
    ).toThrow();
  });

  it('optional fields are omitted when not provided', () => {
    const session = v.parse(DaemonSyncSessionSchema, {
      sessionId: 's-1',
      agentType: 'claude',
      cwd: '/',
      startedAt: 0,
      status: 'active',
      terminalChunks: [],
    });
    expect(session.gitBranch).toBeUndefined();
    expect(session.repoName).toBeUndefined();
    expect(session.exitCode).toBeUndefined();
  });
});

describe('DaemonSyncSchema', () => {
  it('parses a sync message with multiple sessions', () => {
    const msg = v.parse(DaemonSyncSchema, {
      type: 'daemon:sync',
      sessions: [
        {
          sessionId: 's-1',
          agentType: 'claude',
          cwd: '/a',
          startedAt: 100,
          status: 'active',
          terminalChunks: [{ data: 'x', timestamp: 1, seq: 1 }],
        },
        {
          sessionId: 's-2',
          agentType: 'opencode',
          cwd: '/b',
          startedAt: 200,
          status: 'ended',
          exitCode: 0,
          terminalChunks: [],
        },
      ],
    });
    expect(msg.type).toBe('daemon:sync');
    expect(msg.sessions).toHaveLength(2);
  });

  it('parses an empty sync message', () => {
    const msg = v.parse(DaemonSyncSchema, {
      type: 'daemon:sync',
      sessions: [],
    });
    expect(msg.sessions).toHaveLength(0);
  });
});

describe('daemon:sync in UpstreamMessageSchema', () => {
  it('parses daemon:sync as part of upstream union', () => {
    const msg = v.parse(UpstreamMessageSchema, {
      type: 'daemon:sync',
      sessions: [
        {
          sessionId: 's-1',
          agentType: 'claude',
          cwd: '/',
          startedAt: 0,
          status: 'active',
          terminalChunks: [],
        },
      ],
    });
    expect(msg.type).toBe('daemon:sync');
  });
});
