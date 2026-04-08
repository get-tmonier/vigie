import { Layer } from 'effect';
import {
  type AgentAdapter,
  AgentRegistry,
  type AgentRegistryShape,
} from '#modules/agent-session/application/ports/out/agent-adapter.port';
import { claudeAdapter } from './claude.adapter';

function genericAdapter(agentType: string): AgentAdapter {
  return {
    agentType,
    canResume: false,
    detectSessionId: false,
    buildSpawnArgs() {
      return { command: agentType, args: [agentType] };
    },
  };
}

function createAgentRegistry(): AgentRegistryShape {
  const registry: Record<string, AgentAdapter> = {
    claude: claudeAdapter,
    aider: {
      agentType: 'aider',
      canResume: false,
      detectSessionId: false,
      buildSpawnArgs: () => ({ command: 'aider', args: ['aider'] }),
    },
    codex: {
      agentType: 'codex',
      canResume: false,
      detectSessionId: false,
      buildSpawnArgs: () => ({ command: 'codex', args: ['codex'] }),
    },
    opencode: {
      agentType: 'opencode',
      canResume: false,
      detectSessionId: false,
      buildSpawnArgs: () => ({ command: 'opencode', args: ['opencode'] }),
    },
  };

  return {
    resolve(agentType: string): AgentAdapter {
      return registry[agentType] ?? genericAdapter(agentType);
    },
  };
}

export const AgentRegistryLayer = Layer.sync(AgentRegistry)(() => createAgentRegistry());
