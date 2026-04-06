import type { AgentAdapter } from '#modules/session/application/ports/out/agent-adapter.port';

export const codexAdapter: AgentAdapter = {
  agentType: 'codex',
  canResume: false,
  detectSessionId: false,
  buildSpawnArgs() {
    return { command: 'codex', args: ['codex'] };
  },
};
