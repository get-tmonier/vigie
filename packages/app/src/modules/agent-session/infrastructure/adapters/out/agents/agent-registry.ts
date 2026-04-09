import { Layer } from 'effect';
import {
  AgentCatalog,
  type AgentCatalogShape,
  type AgentSpec,
} from '#modules/agent-session/application/ports/out/agent-catalog.port';
import type { AgentType } from '#shared/kernel/session/agent-type';
import { claudeAdapter } from './claude.adapter';

function createAgentCatalog(): AgentCatalogShape {
  const registry: Record<AgentType, AgentSpec> = {
    claude: claudeAdapter,
  };

  return {
    resolve(agentType: AgentType): AgentSpec {
      return registry[agentType];
    },
  };
}

export const AgentCatalogLive = Layer.sync(AgentCatalog)(() => createAgentCatalog());
