import { ServiceMap } from 'effect';
import type { Session } from '#modules/session/domain/session';
import type { SessionId } from '#modules/session/domain/session-id';

export interface ClaudeSessionInfo {
  readonly id: SessionId;
  readonly claudeSessionId: string;
  readonly cwd: string;
  readonly resumable: boolean;
}

export interface SessionRepositoryShape {
  findById(id: SessionId): Session | null;
  findAll(): Session[];
  findActive(): Session[];
  findActiveClaudeWithId(): ClaudeSessionInfo[];
  findRecentlyEndedClaude(withinMs: number): ClaudeSessionInfo[];
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
