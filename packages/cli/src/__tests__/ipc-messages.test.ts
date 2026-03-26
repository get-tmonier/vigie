import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  DaemonToSessionSchema,
  SessionAttachSchema,
  SessionCliResizeSchema,
  SessionDeregisterSchema,
  SessionDetachSchema,
  SessionDoneSchema,
  SessionErrorResponseSchema,
  SessionErrorSchema,
  SessionOutputSchema,
  SessionPtyExitedSchema,
  SessionPtyOutputSchema,
  SessionRegisteredSchema,
  SessionRegisterSchema,
  SessionSpawnedSchema,
  SessionSpawnFailedSchema,
  SessionSpawnInteractiveSchema,
  SessionStdinSchema,
  SessionToDaemonSchema,
} from '../schemas/ipc-messages.js';

describe('SessionToDaemon schemas', () => {
  it('parses session:register', () => {
    const msg = {
      type: 'session:register',
      sessionId: 'abc-123',
      agentType: 'claude',
      cwd: '/tmp',
      gitBranch: 'main',
    };
    const result = v.parse(SessionRegisterSchema, msg);
    expect(result.type).toBe('session:register');
    expect(result.agentType).toBe('claude');
    expect(result.gitBranch).toBe('main');
  });

  it('parses session:output', () => {
    const msg = {
      type: 'session:output',
      sessionId: 'abc-123',
      data: 'hello',
      chunkType: 'text',
      timestamp: 1234,
    };
    const result = v.parse(SessionOutputSchema, msg);
    expect(result.chunkType).toBe('text');
  });

  it('parses session:done', () => {
    const msg = {
      type: 'session:done',
      sessionId: 'abc-123',
      exitCode: 0,
      timestamp: 1234,
    };
    const result = v.parse(SessionDoneSchema, msg);
    expect(result.exitCode).toBe(0);
  });

  it('parses session:error', () => {
    const msg = {
      type: 'session:error',
      sessionId: 'abc-123',
      error: 'something failed',
      timestamp: 1234,
    };
    const result = v.parse(SessionErrorSchema, msg);
    expect(result.error).toBe('something failed');
  });

  it('parses session:deregister', () => {
    const msg = { type: 'session:deregister', sessionId: 'abc-123' };
    const result = v.parse(SessionDeregisterSchema, msg);
    expect(result.sessionId).toBe('abc-123');
  });

  it('parses session:spawn-interactive', () => {
    const msg = {
      type: 'session:spawn-interactive',
      sessionId: 'abc-123',
      agentType: 'claude',
      cwd: '/tmp',
      cols: 120,
      rows: 40,
      gitBranch: 'feat/test',
      repoName: 'my-repo',
    };
    const result = v.parse(SessionSpawnInteractiveSchema, msg);
    expect(result.type).toBe('session:spawn-interactive');
    expect(result.cols).toBe(120);
    expect(result.rows).toBe(40);
    expect(result.gitBranch).toBe('feat/test');
  });

  it('parses session:spawn-interactive without optional fields', () => {
    const msg = {
      type: 'session:spawn-interactive',
      sessionId: 'abc-123',
      agentType: 'claude',
      cwd: '/tmp',
      cols: 80,
      rows: 24,
    };
    const result = v.parse(SessionSpawnInteractiveSchema, msg);
    expect(result.gitBranch).toBeUndefined();
    expect(result.gitRemoteUrl).toBeUndefined();
    expect(result.repoName).toBeUndefined();
  });

  it('parses session:stdin', () => {
    const msg = {
      type: 'session:stdin',
      sessionId: 'abc-123',
      data: 'aGVsbG8=',
    };
    const result = v.parse(SessionStdinSchema, msg);
    expect(result.data).toBe('aGVsbG8=');
  });

  it('parses session:cli-resize', () => {
    const msg = {
      type: 'session:cli-resize',
      sessionId: 'abc-123',
      cols: 200,
      rows: 50,
    };
    const result = v.parse(SessionCliResizeSchema, msg);
    expect(result.cols).toBe(200);
    expect(result.rows).toBe(50);
  });

  it('parses session:detach', () => {
    const msg = { type: 'session:detach', sessionId: 'abc-123' };
    const result = v.parse(SessionDetachSchema, msg);
    expect(result.sessionId).toBe('abc-123');
  });

  it('parses session:attach', () => {
    const msg = {
      type: 'session:attach',
      sessionId: 'abc-123',
      cols: 100,
      rows: 30,
    };
    const result = v.parse(SessionAttachSchema, msg);
    expect(result.cols).toBe(100);
    expect(result.rows).toBe(30);
  });

  it('parses discriminated union', () => {
    const register = v.parse(SessionToDaemonSchema, {
      type: 'session:register',
      sessionId: 'x',
      agentType: 'generic',
      cwd: '/',
    });
    expect(register.type).toBe('session:register');

    const output = v.parse(SessionToDaemonSchema, {
      type: 'session:output',
      sessionId: 'x',
      data: 'test',
      chunkType: 'thinking',
      timestamp: 0,
    });
    expect(output.type).toBe('session:output');

    const spawn = v.parse(SessionToDaemonSchema, {
      type: 'session:spawn-interactive',
      sessionId: 'x',
      agentType: 'claude',
      cwd: '/',
      cols: 80,
      rows: 24,
    });
    expect(spawn.type).toBe('session:spawn-interactive');

    const stdin = v.parse(SessionToDaemonSchema, {
      type: 'session:stdin',
      sessionId: 'x',
      data: 'dGVzdA==',
    });
    expect(stdin.type).toBe('session:stdin');
  });

  it('rejects invalid agent type', () => {
    expect(() =>
      v.parse(SessionRegisterSchema, {
        type: 'session:register',
        sessionId: 'x',
        agentType: 'invalid',
        cwd: '/',
      })
    ).toThrow();
  });
});

describe('DaemonToSession schemas', () => {
  it('parses session:registered', () => {
    const msg = { type: 'session:registered', sessionId: 'abc-123' };
    const result = v.parse(SessionRegisteredSchema, msg);
    expect(result.sessionId).toBe('abc-123');
  });

  it('parses session:error-response', () => {
    const msg = {
      type: 'session:error-response',
      sessionId: 'abc-123',
      error: 'not found',
    };
    const result = v.parse(SessionErrorResponseSchema, msg);
    expect(result.error).toBe('not found');
  });

  it('parses session:spawned', () => {
    const msg = {
      type: 'session:spawned',
      sessionId: 'abc-123',
      pid: 12345,
    };
    const result = v.parse(SessionSpawnedSchema, msg);
    expect(result.pid).toBe(12345);
  });

  it('parses session:spawn-failed', () => {
    const msg = {
      type: 'session:spawn-failed',
      sessionId: 'abc-123',
      error: 'command not found',
    };
    const result = v.parse(SessionSpawnFailedSchema, msg);
    expect(result.error).toBe('command not found');
  });

  it('parses session:pty-output', () => {
    const msg = {
      type: 'session:pty-output',
      sessionId: 'abc-123',
      data: 'aGVsbG8=',
    };
    const result = v.parse(SessionPtyOutputSchema, msg);
    expect(result.data).toBe('aGVsbG8=');
  });

  it('parses session:pty-exited', () => {
    const msg = {
      type: 'session:pty-exited',
      sessionId: 'abc-123',
      exitCode: 0,
    };
    const result = v.parse(SessionPtyExitedSchema, msg);
    expect(result.exitCode).toBe(0);
  });

  it('parses discriminated union', () => {
    const registered = v.parse(DaemonToSessionSchema, {
      type: 'session:registered',
      sessionId: 'x',
    });
    expect(registered.type).toBe('session:registered');

    const spawned = v.parse(DaemonToSessionSchema, {
      type: 'session:spawned',
      sessionId: 'x',
      pid: 999,
    });
    expect(spawned.type).toBe('session:spawned');

    const ptyOutput = v.parse(DaemonToSessionSchema, {
      type: 'session:pty-output',
      sessionId: 'x',
      data: 'dGVzdA==',
    });
    expect(ptyOutput.type).toBe('session:pty-output');

    const ptyExited = v.parse(DaemonToSessionSchema, {
      type: 'session:pty-exited',
      sessionId: 'x',
      exitCode: 1,
    });
    expect(ptyExited.type).toBe('session:pty-exited');
  });
});
