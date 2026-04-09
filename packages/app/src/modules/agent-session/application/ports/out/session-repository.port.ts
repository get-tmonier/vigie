import { ServiceMap } from 'effect';
import type { Session } from '#modules/agent-session/domain/session';
import type { SessionId } from '#shared/kernel/agent-session/session-id';

export interface ResumableSessionInfo {
  readonly id: SessionId;
  readonly agentSessionId: string;
  readonly cwd: string;
  readonly resumable: boolean;
}

export interface SessionRepositoryShape {
  findById(id: SessionId): Session | null;
  findAll(): Session[];
  findActive(): Session[];
  findActiveWithAgentId(): ResumableSessionInfo[];
  findRecentlyEnded(withinMs: number): ResumableSessionInfo[];
  save(session: Session): void;
  delete(id: SessionId): void;
  deleteAllEnded(): void;
  markOrphanedEnded(): void;
  pruneOld(maxAgeMs?: number): void;
}

export class SessionRepository extends ServiceMap.Service<
  SessionRepository,
  SessionRepositoryShape
>()('@vigie/SessionRepository') {}
