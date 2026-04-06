import { Layer } from 'effect';
import {
  type AgentAdapter,
  AgentRegistry,
  type AgentRegistryShape,
} from '#modules/session/application/ports/out/agent-adapter.port';
import { aiderAdapter } from './aider.adapter';
import { claudeAdapter } from './claude.adapter';
import { codexAdapter } from './codex.adapter';
import { opencodeAdapter } from './opencode.adapter';

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

export function createAgentRegistry(): AgentRegistryShape {
  const registry: Record<string, AgentAdapter> = {
    claude: claudeAdapter,
    aider: aiderAdapter,
    codex: codexAdapter,
    opencode: opencodeAdapter,
  };

  return {
    resolve(agentType: string): AgentAdapter {
      return registry[agentType] ?? genericAdapter(agentType);
    },
  };
}

export const AgentRegistryLayer = Layer.sync(AgentRegistry)(() => createAgentRegistry());
