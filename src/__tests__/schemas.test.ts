import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  DaemonToSessionSchema,
  SessionTerminalInputSchema,
  SessionTerminalOutputSchema,
  SessionTerminalResizeSchema,
  SessionToDaemonSchema,
} from '../schemas/ipc-messages.js';
import {
  CommandDoneSchema,
  CommandErrorSchema,
  CommandOutputSchema,
  CommandRequestSchema,
  DaemonHelloSchema,
  DownstreamMessageSchema,
  PingSchema,
  PongSchema,
  TerminalInputDownstreamSchema,
  TerminalOutputUpstreamSchema,
  TerminalResizeDownstreamSchema,
} from '../schemas/messages.js';

describe('downstream message schemas', () => {
  it('parses command:request', () => {
    const msg = { type: 'command:request', id: 'cmd-1', command: 'echo hello' };
    const result = v.parse(CommandRequestSchema, msg);
    expect(result.type).toBe('command:request');
    expect(result.command).toBe('echo hello');
  });

  it('parses command:request with cwd', () => {
    const msg = { type: 'command:request', id: 'cmd-1', command: 'ls', cwd: '/tmp' };
    const result = v.parse(CommandRequestSchema, msg);
    expect(result.cwd).toBe('/tmp');
  });

  it('parses ping', () => {
    const result = v.parse(PingSchema, { type: 'ping' });
    expect(result.type).toBe('ping');
  });

  it('rejects invalid command:request', () => {
    expect(() => v.parse(CommandRequestSchema, { type: 'command:request' })).toThrow();
  });

  it('parses discriminated union', () => {
    const cmd = v.parse(DownstreamMessageSchema, {
      type: 'command:request',
      id: 'x',
      command: 'ls',
    });
    expect(cmd.type).toBe('command:request');

    const ping = v.parse(DownstreamMessageSchema, { type: 'ping' });
    expect(ping.type).toBe('ping');
  });

  it('rejects unknown type', () => {
    expect(() => v.parse(DownstreamMessageSchema, { type: 'unknown' })).toThrow();
  });
});

describe('upstream message schemas', () => {
  it('parses daemon:hello', () => {
    const msg = {
      type: 'daemon:hello',
      hostname: 'h',
      pid: 1,
      version: '0.1.0',
      token: 'tmonier_test',
    };
    const result = v.parse(DaemonHelloSchema, msg);
    expect(result.hostname).toBe('h');
  });

  it('parses command:output', () => {
    const msg = {
      type: 'command:output',
      id: 'cmd-1',
      stream: 'stdout' as const,
      data: 'hi',
      timestamp: 0,
    };
    const result = v.parse(CommandOutputSchema, msg);
    expect(result.stream).toBe('stdout');
  });

  it('parses command:done', () => {
    const msg = { type: 'command:done', id: 'cmd-1', exitCode: 0, timestamp: 0 };
    const result = v.parse(CommandDoneSchema, msg);
    expect(result.exitCode).toBe(0);
  });

  it('parses command:error', () => {
    const msg = { type: 'command:error', id: 'cmd-1', error: 'fail', timestamp: 0 };
    const result = v.parse(CommandErrorSchema, msg);
    expect(result.error).toBe('fail');
  });

  it('parses pong', () => {
    const result = v.parse(PongSchema, { type: 'pong' });
    expect(result.type).toBe('pong');
  });
});

describe('terminal message schemas', () => {
  it('parses terminal:output upstream', () => {
    const msg = { type: 'terminal:output', sessionId: 's-1', data: 'aGVsbG8=', timestamp: 0 };
    const result = v.parse(TerminalOutputUpstreamSchema, msg);
    expect(result.type).toBe('terminal:output');
    expect(result.data).toBe('aGVsbG8=');
  });

  it('parses terminal:input downstream', () => {
    const msg = { type: 'terminal:input', sessionId: 's-1', data: 'aGk=' };
    const result = v.parse(TerminalInputDownstreamSchema, msg);
    expect(result.type).toBe('terminal:input');
  });

  it('parses terminal:resize downstream', () => {
    const msg = {
      type: 'terminal:resize',
      sessionId: 's-1',
      browserConnId: 'conn-1',
      cols: 120,
      rows: 40,
    };
    const result = v.parse(TerminalResizeDownstreamSchema, msg);
    expect(result.cols).toBe(120);
    expect(result.rows).toBe(40);
    expect(result.browserConnId).toBe('conn-1');
  });

  it('terminal:input is part of downstream union', () => {
    const result = v.parse(DownstreamMessageSchema, {
      type: 'terminal:input',
      sessionId: 's-1',
      data: 'aGk=',
    });
    expect(result.type).toBe('terminal:input');
  });

  it('terminal:resize is part of downstream union', () => {
    const result = v.parse(DownstreamMessageSchema, {
      type: 'terminal:resize',
      sessionId: 's-1',
      browserConnId: 'conn-1',
      cols: 80,
      rows: 24,
    });
    expect(result.type).toBe('terminal:resize');
  });
});

describe('IPC terminal schemas', () => {
  it('parses session:terminal-output', () => {
    const msg = {
      type: 'session:terminal-output',
      sessionId: 's-1',
      data: 'aGVsbG8=',
      timestamp: 0,
    };
    const result = v.parse(SessionTerminalOutputSchema, msg);
    expect(result.type).toBe('session:terminal-output');
  });

  it('session:terminal-output is part of SessionToDaemon union', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:terminal-output',
      sessionId: 's-1',
      data: 'aGVsbG8=',
      timestamp: 0,
    });
    expect(result.type).toBe('session:terminal-output');
  });

  it('parses session:terminal-input', () => {
    const msg = { type: 'session:terminal-input', sessionId: 's-1', data: 'aGk=' };
    const result = v.parse(SessionTerminalInputSchema, msg);
    expect(result.type).toBe('session:terminal-input');
  });

  it('parses session:terminal-resize', () => {
    const msg = { type: 'session:terminal-resize', sessionId: 's-1', cols: 80, rows: 24 };
    const result = v.parse(SessionTerminalResizeSchema, msg);
    expect(result.cols).toBe(80);
  });

  it('session:terminal-input is part of DaemonToSession union', () => {
    const result = v.parse(DaemonToSessionSchema, {
      type: 'session:terminal-input',
      sessionId: 's-1',
      data: 'aGk=',
    });
    expect(result.type).toBe('session:terminal-input');
  });

  it('session:register accepts mode field', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:register',
      sessionId: 's-1',
      agentType: 'claude',
      mode: 'interactive',
      cwd: '/tmp',
    });
    if (result.type === 'session:register') {
      expect(result.mode).toBe('interactive');
    }
  });

  it('session:register defaults mode to prompt', () => {
    const result = v.parse(SessionToDaemonSchema, {
      type: 'session:register',
      sessionId: 's-1',
      agentType: 'claude',
      cwd: '/tmp',
    });
    if (result.type === 'session:register') {
      expect(result.mode).toBe('prompt');
    }
  });
});
