import { Layer } from 'effect';
import {
  type AgentAdapter,
  AgentCatalog,
  type AgentCatalogShape,
} from '#modules/agent-session/application/ports/out/agent-adapter.port';
import type { AgentType } from '#shared/kernel/session/agent-type';
import { claudeAdapter } from './claude.adapter';

function createAgentCatalog(): AgentCatalogShape {
  const registry: Record<AgentType, AgentAdapter> = {
    claude: claudeAdapter,
  };

  return {
    resolve(agentType: AgentType): AgentAdapter {
      return registry[agentType];
    },
  };
}

export const AgentCatalogLive = Layer.sync(AgentCatalog)(() => createAgentCatalog());
