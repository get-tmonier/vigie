import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  SessionLifecycleEventSchema,
  SessionStartedSchema,
  TerminalInputEchoSchema,
} from '../events';

describe('SessionStartedSchema', () => {
  it('parses valid event and brands sessionId', () => {
    const result = v.parse(SessionStartedSchema, {
      type: 'session:started',
      sessionId: 'abc-123',
      agentType: 'claude',
      mode: 'interactive',
      cwd: '/home/user',
      timestamp: 1234567890,
    });
    expect(result.type).toBe('session:started');
    expect(String(result.sessionId)).toBe('abc-123');
    expect(result.agentType).toBe('claude');
  });

  it('rejects invalid agentType', () => {
    expect(() =>
      v.parse(SessionStartedSchema, {
        type: 'session:started',
        sessionId: 'abc-123',
        agentType: 'unknown-agent',
        mode: 'interactive',
        cwd: '/home/user',
        timestamp: 1234567890,
      })
    ).toThrow();
  });
});

describe('SessionLifecycleEventSchema', () => {
  it('dispatches on type discriminant', () => {
    const result = v.parse(SessionLifecycleEventSchema, {
      type: 'session:ended',
      sessionId: 'abc-123',
      exitCode: 0,
      resumable: true,
      timestamp: 1234567890,
    });
    expect(result.type).toBe('session:ended');
  });
});

describe('TerminalInputEchoSchema', () => {
  it('parses and brands sessionId', () => {
    const result = v.parse(TerminalInputEchoSchema, {
      type: 'terminal:input-echo',
      sessionId: 'abc-123',
      text: 'hello',
      source: 'cli',
      timestamp: 1234567890,
    });
    expect(String(result.sessionId)).toBe('abc-123');
  });
});
