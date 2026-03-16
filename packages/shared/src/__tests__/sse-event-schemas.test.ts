import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import {
  SSEEventSchema,
  SSESessionResumableChangedSchema,
  SSESessionStartedSchema,
} from '../schemas/sse-events';

describe('SSESessionStartedSchema', () => {
  it('parses session:started without optional fields', () => {
    const event = v.parse(SSESessionStartedSchema, {
      type: 'session:started',
      daemonId: 'd-1',
      sessionId: 's-1',
      agentType: 'claude',
      cwd: '/home/user',
      timestamp: 1000,
    });
    expect(event.resumable).toBeUndefined();
    expect(event.claudeSessionId).toBeUndefined();
    expect(event.mode).toBe('prompt');
  });

  it('parses session:started with resumable and claudeSessionId (sync replay)', () => {
    const event = v.parse(SSESessionStartedSchema, {
      type: 'session:started',
      daemonId: 'd-1',
      sessionId: 's-1',
      agentType: 'claude',
      cwd: '/home/user',
      resumable: true,
      claudeSessionId: 'cs-abc',
      timestamp: 1000,
    });
    expect(event.resumable).toBe(true);
    expect(event.claudeSessionId).toBe('cs-abc');
  });

  it('session:started with resumable parses as part of SSEEvent union', () => {
    const event = v.parse(SSEEventSchema, {
      type: 'session:started',
      daemonId: 'd-1',
      sessionId: 's-1',
      agentType: 'claude',
      cwd: '/home/user',
      resumable: true,
      claudeSessionId: 'cs-abc',
      timestamp: 1000,
    });
    expect(event.type).toBe('session:started');
    if (event.type === 'session:started') {
      expect(event.resumable).toBe(true);
      expect(event.claudeSessionId).toBe('cs-abc');
    }
  });
});

describe('SSESessionResumableChangedSchema', () => {
  it('parses resumable-changed event', () => {
    const event = v.parse(SSESessionResumableChangedSchema, {
      type: 'session:resumable-changed',
      daemonId: 'd-1',
      sessionId: 's-1',
      resumable: true,
      timestamp: 1000,
    });
    expect(event.resumable).toBe(true);
  });

  it('parses as part of SSEEvent union', () => {
    const event = v.parse(SSEEventSchema, {
      type: 'session:resumable-changed',
      daemonId: 'd-1',
      sessionId: 's-1',
      resumable: false,
      timestamp: 1000,
    });
    expect(event.type).toBe('session:resumable-changed');
  });
});
