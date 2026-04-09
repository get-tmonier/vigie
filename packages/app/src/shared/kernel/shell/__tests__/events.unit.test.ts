import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  CommandOutputSchema,
  CommandRequestSchema,
  SessionOutputSchema,
  ShellEventSchema,
} from '../events';

describe('CommandOutputSchema', () => {
  it('parses stdout event', () => {
    const result = v.parse(CommandOutputSchema, {
      type: 'command:output',
      id: 'cmd-1',
      stream: 'stdout',
      data: 'hello',
      timestamp: 1234567890,
    });
    expect(result.stream).toBe('stdout');
  });
});

describe('SessionOutputSchema', () => {
  it('parses session output with branded sessionId', () => {
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

describe('CommandRequestSchema', () => {
  it('parses a command request', () => {
    const result = v.parse(CommandRequestSchema, {
      type: 'command:request',
      id: 'req-1',
      command: 'ls -la',
      cwd: '/home/user',
    });
    expect(result.command).toBe('ls -la');
  });

  it('accepts missing optional cwd', () => {
    const result = v.parse(CommandRequestSchema, {
      type: 'command:request',
      id: 'req-1',
      command: 'pwd',
    });
    expect(result.cwd).toBeUndefined();
  });
});

describe('ShellEventSchema', () => {
  it('dispatches on type discriminant', () => {
    const result = v.parse(ShellEventSchema, { type: 'pong' });
    expect(result.type).toBe('pong');
  });
});
