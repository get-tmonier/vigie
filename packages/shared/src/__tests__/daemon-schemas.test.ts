import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  CommandDoneSchema,
  CommandErrorSchema,
  CommandOutputSchema,
  CommandRequestSchema,
  DaemonHelloSchema,
  DownstreamMessageSchema,
  PingSchema,
  PongSchema,
  UpstreamMessageSchema,
} from '../schemas/daemon.js';
import {
  SSECommandOutputSchema,
  SSEDaemonConnectedSchema,
  SSEDaemonDisconnectedSchema,
  SSEEventSchema,
} from '../schemas/sse-events.js';

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
