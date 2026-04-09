// In-memory store for Session domain entities. Provides CRUD and query helpers
// (active sessions, recently ended, orphan cleanup). Backed by SQLite in production.
import { ServiceMap } from 'effect';
import type { Session } from '#modules/agent-session/domain/session';
import type { AgentType } from '#shared/kernel/session/agent-type';
import type { SessionId } from '#shared/kernel/session/session-id';

export interface ResumableSessionInfo {
  readonly id: SessionId;
  readonly agentSessionId: string;
  readonly cwd: string;
  readonly resumable: boolean;
  readonly agentType: AgentType;
}

export interface SessionStoreShape {
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

export class SessionStore extends ServiceMap.Service<SessionStore, SessionStoreShape>()(
  '@vigie/SessionStore'
) {}
