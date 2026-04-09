import type { SessionStoreShape } from '#modules/agent-session/application/ports/out/session-store.port';
import type { TerminalRepositoryShape } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import type { Session } from '#modules/agent-session/domain/session';
import type { SessionId } from '#shared/kernel/session/session-id';

interface SessionQueriesDeps {
  sessionRepo: SessionStoreShape;
  terminalRepo: TerminalRepositoryShape;
}

export type SessionQueriesShape = ReturnType<typeof createSessionQueriesUseCase>;

export function createSessionQueriesUseCase(deps: SessionQueriesDeps) {
  const { sessionRepo, terminalRepo } = deps;

  return {
    listAll(): Session[] {
      return sessionRepo.findAll();
    },

    findById(sessionId: SessionId): Session | null {
      return sessionRepo.findById(sessionId);
    },

    getAllChunks(sessionId: SessionId): Array<{ data: string }> {
      return terminalRepo.getAllChunks(sessionId);
    },

    getInputHistory(
      sessionId: SessionId,
      limit?: number
    ): Array<{ text: string; source: string; timestamp: number }> {
      return terminalRepo.getInputHistory(sessionId, limit);
    },
  };
}
