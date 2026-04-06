import type { AgentAdapter } from '#modules/session/application/ports/out/agent-adapter.port';

export const claudeAdapter: AgentAdapter = {
  agentType: 'claude',
  canResume: true,
  detectSessionId: true,
  buildSpawnArgs(opts) {
    const args: string[] = ['claude'];
    if (opts?.agentSessionId) {
      if (opts.resume) {
        args.push('--resume', opts.agentSessionId);
      } else {
        args.push('--session-id', opts.agentSessionId);
      }
    }
    return { command: 'claude', args };
  },
};
