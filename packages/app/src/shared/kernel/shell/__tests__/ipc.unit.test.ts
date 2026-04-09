import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { DaemonToSessionSchema, SessionToDaemonSchema } from '../ipc';

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

  it('rejects unknown message type', () => {
    expect(() =>
      v.parse(SessionToDaemonSchema, { type: 'unknown:message', sessionId: 'abc' })
    ).toThrow();
  });
});

describe('DaemonToSessionSchema', () => {
  it('parses session:spawned', () => {
    const result = v.parse(DaemonToSessionSchema, {
      type: 'session:spawned',
      sessionId: 'abc-123',
      pid: 1234,
    });
    expect(result.type).toBe('session:spawned');
  });
});
