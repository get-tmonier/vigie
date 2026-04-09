import { Layer } from 'effect';
import {
  type AgentAdapter,
  AgentRegistry,
  type AgentRegistryShape,
} from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { AgentType } from '#shared/kernel/agent-session/agent-type';
import { claudeAdapter } from './claude.adapter';

function createAgentRegistry(): AgentRegistryShape {
  const registry: Record<AgentType, AgentAdapter> = {
    claude: claudeAdapter,
  };

  return {
    resolve(agentType: AgentType): AgentAdapter {
      return registry[agentType];
    },
  };
}

export const AgentRegistryLive = Layer.sync(AgentRegistry)(() => createAgentRegistry());
