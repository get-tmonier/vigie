import type { SessionStarted } from '@tmonier/shared';

export interface AgentSession {
  readonly id: string;
  readonly daemonId: string;
  readonly agentType: 'claude' | 'opencode' | 'generic';
  readonly mode: 'prompt' | 'interactive';
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly repoName?: string;
  readonly startedAt: number;
  readonly status: 'active' | 'ended';
}

export function createAgentSession(daemonId: string, msg: SessionStarted): AgentSession {
  return {
    id: msg.sessionId,
    daemonId,
    agentType: msg.agentType,
    mode: msg.mode ?? 'prompt',
    cwd: msg.cwd,
    gitBranch: msg.gitBranch,
    repoName: msg.repoName,
    startedAt: msg.timestamp,
    status: 'active',
  };
}
