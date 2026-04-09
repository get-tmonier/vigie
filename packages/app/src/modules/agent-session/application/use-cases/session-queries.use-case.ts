import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { TerminalRepositoryShape } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import type { Session } from '#modules/agent-session/domain/session';
import type { SessionId } from '#shared/kernel/agent-session/session-id';

interface SessionQueriesDeps {
  sessionRepo: SessionRepositoryShape;
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
