import type { SessionRepositoryShape } from '#modules/agent-session/application/ports/out/session-repository.port';
import type { TerminalRepositoryShape } from '#modules/agent-session/application/ports/out/terminal-repository.port';
import type { Session } from '#modules/agent-session/domain/session';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';

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

    findById(sessionId: string): Session | null {
      return sessionRepo.findById(makeSessionId(sessionId));
    },

    getAllChunks(sessionId: string): Array<{ data: string }> {
      return terminalRepo.getAllChunks(sessionId);
    },

    getInputHistory(
      sessionId: string,
      limit?: number
    ): Array<{ text: string; source: string; timestamp: number }> {
      return terminalRepo.getInputHistory(sessionId, limit);
    },
  };
}
