import { describe, expect, it } from 'bun:test';
import { createDaemonSession, deriveDaemonId } from '../daemon-session';

describe('deriveDaemonId', () => {
  it('returns a deterministic 32-char hex string', () => {
    const id = deriveDaemonId('user-1', 'dev-box');
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(deriveDaemonId('user-1', 'dev-box')).toBe(id);
  });

  it('produces different IDs for different inputs', () => {
    const a = deriveDaemonId('user-1', 'host-a');
    const b = deriveDaemonId('user-1', 'host-b');
    const c = deriveDaemonId('user-2', 'host-a');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('createDaemonSession', () => {
  it('creates a session with the given daemon ID', () => {
    const hello = {
      type: 'daemon:hello' as const,
      hostname: 'dev-box',
      pid: 1234,
      version: '0.1.0',
    };
    const daemonId = deriveDaemonId('user-1', 'dev-box');
    const session = createDaemonSession(daemonId, hello, 'user-1');

    expect(session.id).toBe(daemonId);
    expect(session.userId).toBe('user-1');
    expect(session.hostname).toBe('dev-box');
    expect(session.pid).toBe(1234);
    expect(session.version).toBe('0.1.0');
    expect(session.connectedAt).toBeLessThanOrEqual(Date.now());
  });
});
