// AgentSpec: static descriptor for one agent type — spawn args, resumability flags.
// AgentCatalog: resolves the right AgentSpec by agentType at runtime.
import { ServiceMap } from 'effect';
import type { AgentType } from '#shared/kernel/session/agent-type';

export interface AgentSpec {
  readonly agentType: AgentType;
  readonly canResume: boolean;
  readonly detectSessionId: boolean;
  buildSpawnArgs(opts?: { agentSessionId?: string; resume?: boolean }): {
    command: string;
    args: string[];
  };
  isResumable(agentSessionId: string, cwd: string): boolean;
}

export interface AgentCatalogShape {
  resolve(agentType: AgentType): AgentSpec;
}

export class AgentCatalog extends ServiceMap.Service<AgentCatalog, AgentCatalogShape>()(
  '@vigie/AgentCatalog'
) {}
