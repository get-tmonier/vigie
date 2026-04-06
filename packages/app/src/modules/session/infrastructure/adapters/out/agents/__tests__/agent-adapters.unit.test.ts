import { describe, expect, it } from 'bun:test';
import { createAgentRegistry } from '../agent-registry';
import { claudeAdapter } from '../claude.adapter';

describe('claudeAdapter', () => {
  it('has correct properties', () => {
    expect(claudeAdapter.agentType).toBe('claude');
    expect(claudeAdapter.canResume).toBe(true);
    expect(claudeAdapter.detectSessionId).toBe(true);
  });

  it('buildSpawnArgs with resume + agentSessionId → --resume flag', () => {
    const { command, args } = claudeAdapter.buildSpawnArgs({
      resume: true,
      agentSessionId: 'abc123',
    });
    expect(command).toBe('claude');
    expect(args).toEqual(['claude', '--resume', 'abc123']);
  });

  it('buildSpawnArgs with agentSessionId only → --session-id flag', () => {
    const { command, args } = claudeAdapter.buildSpawnArgs({ agentSessionId: 'abc123' });
    expect(command).toBe('claude');
    expect(args).toEqual(['claude', '--session-id', 'abc123']);
  });

  it('buildSpawnArgs with no opts → just claude', () => {
    expect(claudeAdapter.buildSpawnArgs()).toEqual({ command: 'claude', args: ['claude'] });
    expect(claudeAdapter.buildSpawnArgs({})).toEqual({ command: 'claude', args: ['claude'] });
  });
});

describe('createAgentRegistry', () => {
  const registry = createAgentRegistry();

  it('resolves claude with canResume=true and detectSessionId=true', () => {
    const adapter = registry.resolve('claude');
    expect(adapter.agentType).toBe('claude');
    expect(adapter.canResume).toBe(true);
    expect(adapter.detectSessionId).toBe(true);
  });

  it('resolves aider with canResume=false', () => {
    const adapter = registry.resolve('aider');
    expect(adapter.agentType).toBe('aider');
    expect(adapter.canResume).toBe(false);
    expect(adapter.buildSpawnArgs()).toEqual({ command: 'aider', args: ['aider'] });
  });

  it('resolves codex with canResume=false', () => {
    const adapter = registry.resolve('codex');
    expect(adapter.agentType).toBe('codex');
    expect(adapter.canResume).toBe(false);
    expect(adapter.buildSpawnArgs()).toEqual({ command: 'codex', args: ['codex'] });
  });

  it('resolves opencode with canResume=false', () => {
    const adapter = registry.resolve('opencode');
    expect(adapter.agentType).toBe('opencode');
    expect(adapter.canResume).toBe(false);
  });

  it('falls back to generic adapter for unknown agent types', () => {
    const adapter = registry.resolve('my-custom-tool');
    expect(adapter.agentType).toBe('my-custom-tool');
    expect(adapter.canResume).toBe(false);
    expect(adapter.detectSessionId).toBe(false);
    expect(adapter.buildSpawnArgs()).toEqual({
      command: 'my-custom-tool',
      args: ['my-custom-tool'],
    });
  });
});
