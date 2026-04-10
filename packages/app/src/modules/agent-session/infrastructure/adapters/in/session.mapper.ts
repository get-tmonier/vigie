import type { Session } from '#modules/agent-session/domain/session';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';

export function sessionToDTO(session: Session): AgentSession {
  return {
    id: session.id,
    agentType: session.agentType,
    mode: session.mode,
    cwd: session.cwd,
    gitBranch: session.gitBranch,
    repoName: session.repoName,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: session.status,
    exitCode: session.exitCode,
    agentSessionId: session.agentSessionId,
    resumable: session.resumable,
    sessionType: session.sessionType,
    autoAdvance: session.autoAdvance,
    currentTurnIndex: session.currentTurnIndex,
    totalCostUsd: session.totalCostUsd,
  };
}
