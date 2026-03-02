import { describe, expect, it } from 'bun:test';
import { createCommand } from '../command';

describe('createCommand', () => {
  it('creates a command with generated id', () => {
    const cmd = createCommand('daemon-1', 'echo hello');
    expect(cmd.id).toBeDefined();
    expect(cmd.daemonId).toBe('daemon-1');
    expect(cmd.command).toBe('echo hello');
    expect(cmd.cwd).toBeUndefined();
    expect(cmd.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it('creates a command with cwd', () => {
    const cmd = createCommand('daemon-1', 'ls', '/tmp');
    expect(cmd.cwd).toBe('/tmp');
  });

  it('generates unique ids', () => {
    const c1 = createCommand('d', 'ls');
    const c2 = createCommand('d', 'ls');
    expect(c1.id).not.toBe(c2.id);
  });
});
