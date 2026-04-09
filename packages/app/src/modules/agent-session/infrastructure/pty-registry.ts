import type { PtyEntry } from '#modules/agent-session/infrastructure/pty-manager.types';
import type { SessionId } from '#shared/kernel/session/session-id';

export type { PtyEntry };

export interface PtyRegistry {
  ptyHandles: Map<SessionId, PtyEntry>;
  sessionConnections: Map<SessionId, string>; // sessionId → connId
  connSessions: Map<string, SessionId>; // connId → sessionId
}

export function createPtyRegistry(): PtyRegistry {
  return {
    ptyHandles: new Map(),
    sessionConnections: new Map(),
    connSessions: new Map(),
  };
}
