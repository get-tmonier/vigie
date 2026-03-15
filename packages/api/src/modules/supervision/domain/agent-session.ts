import type { DaemonSyncSession, SessionStarted } from '@tmonier/shared';

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
  readonly claudeSessionId?: string;
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

export function createAgentSessionFromSync(
  daemonId: string,
  session: DaemonSyncSession
): AgentSession {
  return {
    id: session.sessionId,
    daemonId,
    agentType: session.agentType,
    mode: session.mode ?? 'prompt',
    cwd: session.cwd,
    gitBranch: session.gitBranch,
    repoName: session.repoName,
    startedAt: session.startedAt,
    status: session.status === 'active' ? 'active' : 'ended',
  };
}
