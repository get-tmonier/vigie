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
