import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  CommandDoneSchema,
  CommandErrorSchema,
  CommandOutputSchema,
  CommandRequestSchema,
  DaemonHelloSchema,
  DownstreamMessageSchema,
  DownstreamTerminalMessageSchema,
  PingSchema,
  PongSchema,
  TerminalInputSchema,
  TerminalOutputSchema,
  TerminalPtyResizedSchema,
  TerminalResizeSchema,
  UpstreamMessageSchema,
} from '../schemas/daemon';
import {
  SSECommandOutputSchema,
  SSEDaemonConnectedSchema,
  SSEDaemonDisconnectedSchema,
  SSEEventSchema,
} from '../schemas/sse-events';

describe('daemon downstream schemas', () => {
  it('parses command:request', () => {
    const msg = { type: 'command:request', id: 'cmd-1', command: 'echo hello' };
    const result = v.parse(CommandRequestSchema, msg);
    expect(result.type).toBe('command:request');
    expect(result.id).toBe('cmd-1');
    expect(result.command).toBe('echo hello');
    expect(result.cwd).toBeUndefined();
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

  it('parses downstream discriminated union', () => {
    const cmd = v.parse(DownstreamMessageSchema, {
      type: 'command:request',
      id: 'x',
      command: 'ls',
    });
    expect(cmd.type).toBe('command:request');

    const ping = v.parse(DownstreamMessageSchema, { type: 'ping' });
    expect(ping.type).toBe('ping');
  });

  it('rejects unknown downstream type', () => {
    expect(() => v.parse(DownstreamMessageSchema, { type: 'unknown' })).toThrow();
  });
});

describe('daemon upstream schemas', () => {
  it('parses daemon:hello', () => {
    const msg = { type: 'daemon:hello', hostname: 'host1', pid: 1234, version: '0.1.0' };
    const result = v.parse(DaemonHelloSchema, msg);
    expect(result.hostname).toBe('host1');
    expect(result.pid).toBe(1234);
  });

  it('parses command:output', () => {
    const msg = {
      type: 'command:output',
      id: 'cmd-1',
      stream: 'stdout' as const,
      data: 'hello\n',
      timestamp: Date.now(),
    };
    const result = v.parse(CommandOutputSchema, msg);
    expect(result.stream).toBe('stdout');
    expect(result.data).toBe('hello\n');
  });

  it('rejects invalid stream value', () => {
    const msg = {
      type: 'command:output',
      id: 'cmd-1',
      stream: 'invalid',
      data: 'x',
      timestamp: 0,
    };
    expect(() => v.parse(CommandOutputSchema, msg)).toThrow();
  });

  it('parses command:done', () => {
    const msg = { type: 'command:done', id: 'cmd-1', exitCode: 0, timestamp: Date.now() };
    const result = v.parse(CommandDoneSchema, msg);
    expect(result.exitCode).toBe(0);
  });

  it('parses command:error', () => {
    const msg = {
      type: 'command:error',
      id: 'cmd-1',
      error: 'spawn failed',
      timestamp: Date.now(),
    };
    const result = v.parse(CommandErrorSchema, msg);
    expect(result.error).toBe('spawn failed');
  });

  it('parses pong', () => {
    const result = v.parse(PongSchema, { type: 'pong' });
    expect(result.type).toBe('pong');
  });

  it('parses upstream discriminated union', () => {
    const hello = v.parse(UpstreamMessageSchema, {
      type: 'daemon:hello',
      hostname: 'h',
      pid: 1,
      version: '0.1.0',
    });
    expect(hello.type).toBe('daemon:hello');

    const output = v.parse(UpstreamMessageSchema, {
      type: 'command:output',
      id: 'x',
      stream: 'stderr',
      data: 'err',
      timestamp: 0,
    });
    expect(output.type).toBe('command:output');

    const done = v.parse(UpstreamMessageSchema, {
      type: 'command:done',
      id: 'x',
      exitCode: 1,
      timestamp: 0,
    });
    expect(done.type).toBe('command:done');

    const pong = v.parse(UpstreamMessageSchema, { type: 'pong' });
    expect(pong.type).toBe('pong');
  });

  it('rejects unknown upstream type', () => {
    expect(() => v.parse(UpstreamMessageSchema, { type: 'unknown' })).toThrow();
  });
});

describe('terminal schemas', () => {
  it('parses terminal:output', () => {
    const msg = {
      type: 'terminal:output',
      sessionId: 's-1',
      data: 'aGVsbG8=',
      timestamp: Date.now(),
    };
    const result = v.parse(TerminalOutputSchema, msg);
    expect(result.type).toBe('terminal:output');
    expect(result.data).toBe('aGVsbG8=');
  });

  it('parses terminal:input', () => {
    const msg = { type: 'terminal:input', sessionId: 's-1', data: 'aGk=' };
    const result = v.parse(TerminalInputSchema, msg);
    expect(result.type).toBe('terminal:input');
    expect(result.sessionId).toBe('s-1');
  });

  it('parses terminal:resize', () => {
    const msg = {
      type: 'terminal:resize',
      sessionId: 's-1',
      browserConnId: 'conn-1',
      cols: 80,
      rows: 24,
    };
    const result = v.parse(TerminalResizeSchema, msg);
    expect(result.cols).toBe(80);
    expect(result.rows).toBe(24);
    expect(result.browserConnId).toBe('conn-1');
  });

  it('parses terminal:pty-resized', () => {
    const msg = { type: 'terminal:pty-resized', sessionId: 's-1', cols: 80, rows: 23 };
    const result = v.parse(TerminalPtyResizedSchema, msg);
    expect(result.cols).toBe(80);
    expect(result.rows).toBe(23);
  });

  it('terminal:pty-resized is part of upstream union', () => {
    const result = v.parse(UpstreamMessageSchema, {
      type: 'terminal:pty-resized',
      sessionId: 's-1',
      cols: 80,
      rows: 23,
    });
    expect(result.type).toBe('terminal:pty-resized');
  });

  it('terminal:output is part of upstream union', () => {
    const result = v.parse(UpstreamMessageSchema, {
      type: 'terminal:output',
      sessionId: 's-1',
      data: 'aGVsbG8=',
      timestamp: 0,
    });
    expect(result.type).toBe('terminal:output');
  });

  it('parses downstream terminal discriminated union', () => {
    const input = v.parse(DownstreamTerminalMessageSchema, {
      type: 'terminal:input',
      sessionId: 's-1',
      data: 'aGk=',
    });
    expect(input.type).toBe('terminal:input');

    const resize = v.parse(DownstreamTerminalMessageSchema, {
      type: 'terminal:resize',
      sessionId: 's-1',
      browserConnId: 'conn-1',
      cols: 120,
      rows: 40,
    });
    expect(resize.type).toBe('terminal:resize');
  });

  it('session:started accepts mode field', () => {
    const msg = {
      type: 'session:started',
      sessionId: 's-1',
      agentType: 'claude',
      mode: 'interactive',
      cwd: '/tmp',
      timestamp: Date.now(),
    };
    const result = v.parse(UpstreamMessageSchema, msg);
    expect(result.type).toBe('session:started');
    if (result.type === 'session:started') {
      expect(result.mode).toBe('interactive');
    }
  });

  it('session:started defaults mode to prompt', () => {
    const msg = {
      type: 'session:started',
      sessionId: 's-1',
      agentType: 'claude',
      cwd: '/tmp',
      timestamp: Date.now(),
    };
    const result = v.parse(UpstreamMessageSchema, msg);
    if (result.type === 'session:started') {
      expect(result.mode).toBe('prompt');
    }
  });
});

describe('SSE event schemas', () => {
  it('parses command:output SSE event', () => {
    const event = {
      type: 'command:output',
      id: 'cmd-1',
      stream: 'stdout' as const,
      data: 'output',
      timestamp: Date.now(),
    };
    const result = v.parse(SSECommandOutputSchema, event);
    expect(result.type).toBe('command:output');
  });

  it('parses daemon:connected SSE event', () => {
    const event = {
      type: 'daemon:connected',
      daemonId: 'd-1',
      hostname: 'host1',
      timestamp: Date.now(),
    };
    const result = v.parse(SSEDaemonConnectedSchema, event);
    expect(result.daemonId).toBe('d-1');
  });

  it('parses daemon:disconnected SSE event', () => {
    const event = {
      type: 'daemon:disconnected',
      daemonId: 'd-1',
      hostname: 'host1',
      timestamp: Date.now(),
    };
    const result = v.parse(SSEDaemonDisconnectedSchema, event);
    expect(result.daemonId).toBe('d-1');
  });

  it('parses SSE discriminated union', () => {
    const connected = v.parse(SSEEventSchema, {
      type: 'daemon:connected',
      daemonId: 'd-1',
      hostname: 'h',
      timestamp: 0,
    });
    expect(connected.type).toBe('daemon:connected');

    const output = v.parse(SSEEventSchema, {
      type: 'command:output',
      id: 'x',
      stream: 'stdout',
      data: 'd',
      timestamp: 0,
    });
    expect(output.type).toBe('command:output');
  });

  it('rejects unknown SSE event type', () => {
    expect(() => v.parse(SSEEventSchema, { type: 'unknown' })).toThrow();
  });
});
