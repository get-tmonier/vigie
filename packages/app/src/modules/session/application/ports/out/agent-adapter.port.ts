import { ServiceMap } from 'effect';

export interface AgentAdapter {
  readonly agentType: string;
  readonly canResume: boolean;
  readonly detectSessionId: boolean;
  buildSpawnArgs(opts?: { claudeSessionId?: string; resume?: boolean }): {
    command: string;
    args: string[];
  };
}

export interface AgentRegistryShape {
  resolve(agentType: string): AgentAdapter;
}

export class AgentRegistry extends ServiceMap.Service<AgentRegistry, AgentRegistryShape>()(
  '@vigie/AgentRegistry'
) {}
