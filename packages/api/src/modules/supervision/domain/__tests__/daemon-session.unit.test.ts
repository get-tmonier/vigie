import { describe, expect, it } from 'bun:test';
import { createDaemonSession } from '../daemon-session';

describe('createDaemonSession', () => {
  it('creates a session from a hello message', () => {
    const hello = {
      type: 'daemon:hello' as const,
      hostname: 'dev-box',
      pid: 1234,
      version: '0.1.0',
    };
    const session = createDaemonSession(hello, 'user-1');

    expect(session.id).toBeDefined();
    expect(session.id.length).toBeGreaterThan(0);
    expect(session.userId).toBe('user-1');
    expect(session.hostname).toBe('dev-box');
    expect(session.pid).toBe(1234);
    expect(session.version).toBe('0.1.0');
    expect(session.connectedAt).toBeLessThanOrEqual(Date.now());
  });

  it('generates unique ids', () => {
    const hello = { type: 'daemon:hello' as const, hostname: 'h', pid: 1, version: '0.1.0' };
    const s1 = createDaemonSession(hello, 'user-1');
    const s2 = createDaemonSession(hello, 'user-1');
    expect(s1.id).not.toBe(s2.id);
  });
});
