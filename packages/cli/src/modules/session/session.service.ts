import { Effect, Ref } from 'effect';
import type { AgentSession } from './domain/session.js';

export function createSessionService(sessions: Ref.Ref<Map<string, AgentSession>>) {
  const sessionConnections = new Map<string, string>(); // sessionId → connId
  const connSessions = new Map<string, string>(); // connId → sessionId

  function addSession(session: AgentSession): void {
    Effect.runSync(Ref.update(sessions, (map) => new Map([...map, [session.id, session]])));
  }

  function updateStatus(sessionId: string, status: AgentSession['status']): void {
    Effect.runSync(
      Ref.update(sessions, (map) => {
        const newMap = new Map(map);
        const s = newMap.get(sessionId);
        if (s) newMap.set(sessionId, { ...s, status });
        return newMap;
      })
    );
  }

  function removeSession(sessionId: string): void {
    Effect.runSync(
      Ref.update(sessions, (map) => {
        const newMap = new Map(map);
        newMap.delete(sessionId);
        return newMap;
      })
    );
  }

  return {
    sessionConnections,
    connSessions,
    addSession,
    updateStatus,
    removeSession,
  };
}
