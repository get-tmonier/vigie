export type AgentType = 'claude' | 'aider' | 'codex' | 'generic' | (string & {});
export type SessionStatus = 'registering' | 'active' | 'ended' | 'error';

export interface AgentSession {
  readonly id: string;
  readonly agentType: AgentType;
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly gitRemoteUrl?: string;
  readonly repoName?: string;
  readonly startedAt: number;
  readonly status: SessionStatus;
}
