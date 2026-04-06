import type { AgentAdapter } from '#modules/session/application/ports/out/agent-adapter.port';

export const opencodeAdapter: AgentAdapter = {
  agentType: 'opencode',
  canResume: false,
  detectSessionId: false,
  buildSpawnArgs() {
    return { command: 'opencode', args: ['opencode'] };
  },
};
