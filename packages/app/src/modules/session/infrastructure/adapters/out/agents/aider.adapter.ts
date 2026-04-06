import type { AgentAdapter } from '#modules/session/application/ports/out/agent-adapter.port';

export const aiderAdapter: AgentAdapter = {
  agentType: 'aider',
  canResume: false,
  detectSessionId: false,
  buildSpawnArgs() {
    return { command: 'aider', args: ['aider'] };
  },
};
