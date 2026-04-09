import { ServiceMap } from 'effect';
import type { AgentType } from '#shared/kernel/session/agent-type';

export interface AgentAdapter {
  readonly agentType: AgentType;
  readonly canResume: boolean;
  readonly detectSessionId: boolean;
  buildSpawnArgs(opts?: { agentSessionId?: string; resume?: boolean }): {
    command: string;
    args: string[];
  };
}

export interface AgentCatalogShape {
  resolve(agentType: AgentType): AgentAdapter;
}

export class AgentCatalog extends ServiceMap.Service<AgentCatalog, AgentCatalogShape>()(
  '@vigie/AgentCatalog'
) {}
