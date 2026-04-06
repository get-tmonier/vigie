import type { Session } from '#modules/session/domain/session';
import type { AgentSession } from '#modules/session/infrastructure/adapters/in/session.dto';

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
    claudeSessionId: session.claudeSessionId,
    resumable: session.resumable,
  };
}
