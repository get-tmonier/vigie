import type { AgentAdapter } from '#modules/session/application/ports/out/agent-adapter.port';

export const claudeAdapter: AgentAdapter = {
  agentType: 'claude',
  canResume: true,
  detectSessionId: true,
  buildSpawnArgs(opts) {
    const args: string[] = ['claude'];
    if (opts?.claudeSessionId) {
      if (opts.resume) {
        args.push('--resume', opts.claudeSessionId);
      } else {
        args.push('--session-id', opts.claudeSessionId);
      }
    }
    return { command: 'claude', args };
  },
};
