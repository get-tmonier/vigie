import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { SessionId } from '#shared/kernel/session/session-id';
import {
  DaemonToSessionSchema,
  SessionOutputSchema,
  SessionSpawnFailedSchema,
  SessionToDaemonSchema,
} from '../ipc';

describe('SessionToDaemonSchema', () => {
  it('parses session:register and brands sessionId', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:register',
      sessionId: 'abc-123',
      agentType: 'claude',
      cwd: '/home/user',
    });
    expect(result.type).toBe('session:register');
    expect(String(result.sessionId)).toBe('abc-123');
  });

  it('parses session:output', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:output',
      sessionId: 'abc-123',
      data: 'hello',
      chunkType: 'text',
      timestamp: 1234567890,
    });
    expect(result.type).toBe('session:output');
  });

  it('parses session:done', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:done',
      sessionId: 'abc-123',
      exitCode: 0,
      timestamp: 1234,
    });
    expect(result.type).toBe('session:done');
  });

  it('parses session:error', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:error',
      sessionId: 'abc-123',
      error: 'something failed',
      timestamp: 1234,
    });
    expect(result.type).toBe('session:error');
  });

  it('parses session:deregister', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:deregister',
      sessionId: 'abc-123',
    });
    expect(result.sessionId).toBe(SessionId('abc-123'));
  });

  it('parses session:spawn-interactive', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:spawn-interactive',
      sessionId: 'abc-123',
      agentType: 'claude',
      cwd: '/tmp',
      cols: 120,
      rows: 40,
      gitBranch: 'feat/test',
      repoName: 'my-repo',
    });
    expect(result.type).toBe('session:spawn-interactive');
  });

  it('parses session:spawn-interactive without optional fields', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:spawn-interactive',
      sessionId: 'abc-123',
      agentType: 'claude',
      cwd: '/tmp',
      cols: 80,
      rows: 24,
    });
    expect(result.type).toBe('session:spawn-interactive');
  });

  it('parses session:stdin', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:stdin',
      sessionId: 'abc-123',
      data: 'aGVsbG8=',
    });
    expect(result.type).toBe('session:stdin');
  });

  it('parses session:cli-resize', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:cli-resize',
      sessionId: 'abc-123',
      cols: 200,
      rows: 50,
    });
    expect(result.type).toBe('session:cli-resize');
  });

  it('parses session:detach', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:detach',
      sessionId: 'abc-123',
    });
    expect(result.sessionId).toBe(SessionId('abc-123'));
  });

  it('parses session:attach', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:attach',
      sessionId: 'abc-123',
      cols: 100,
      rows: 30,
    });
    expect(result.type).toBe('session:attach');
  });

  it('rejects unknown message type', () => {
    expect(() =>
      v.parse(SessionToDaemonSchema, { type: 'unknown:message', sessionId: 'abc' })
    ).toThrow();
  });

  it('accepts claude agentType', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:register',
      sessionId: 'x',
      agentType: 'claude',
      cwd: '/',
    });
    if (result.type !== 'session:register') throw new Error('unexpected type');
    expect(result.agentType).toBe('claude');
  });
});

describe('DaemonToSessionSchema', () => {
  it('parses session:registered', () => {
    const result = v.parse(DaemonToSessionSchema, {
      type: 'session:registered',
      sessionId: 'abc-123',
    });
    expect(result.sessionId).toBe(SessionId('abc-123'));
  });

  it('parses session:error-response', () => {
    const result = v.parse(DaemonToSessionSchema, {
      type: 'session:error-response',
      sessionId: 'abc-123',
      error: 'not found',
    });
    expect(result.type).toBe('session:error-response');
  });

  it('parses session:spawned', () => {
    const result = v.parse(DaemonToSessionSchema, {
      type: 'session:spawned',
      sessionId: 'abc-123',
      pid: 1234,
    });
    expect(result.type).toBe('session:spawned');
  });

  it('parses session:spawn-failed', () => {
    const result = v.parse(SessionSpawnFailedSchema, {
      type: 'session:spawn-failed',
      sessionId: 'abc-123',
      error: 'command not found',
      timestamp: 1234,
    });
    expect(result.error).toBe('command not found');
  });

  it('parses session:pty-output', () => {
    const result = v.parse(DaemonToSessionSchema, {
      type: 'session:pty-output',
      sessionId: 'abc-123',
      data: 'aGVsbG8=',
    });
    expect(result.type).toBe('session:pty-output');
  });

  it('parses session:pty-exited', () => {
    const result = v.parse(DaemonToSessionSchema, {
      type: 'session:pty-exited',
      sessionId: 'abc-123',
      exitCode: 0,
    });
    expect(result.type).toBe('session:pty-exited');
  });
});

describe('Cross-protocol schemas', () => {
  it('parses SessionOutputSchema', () => {
    const result = v.parse(SessionOutputSchema, {
      type: 'session:output',
      sessionId: 'abc-123',
      data: 'some output',
      chunkType: 'text',
      timestamp: 1234567890,
    });
    expect(result.chunkType).toBe('text');
  });
});
