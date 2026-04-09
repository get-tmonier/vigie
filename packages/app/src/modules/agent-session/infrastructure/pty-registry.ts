import type { PtyHandle } from '#modules/agent-session/application/ports/out/pty-spawner.port';
import type { SessionId } from '#shared/kernel/agent-session/session-id';

export interface PtyEntry {
  handle: PtyHandle;
  cliChannels: Map<string, { cols: number; rows: number }>;
  browserChannels: Map<string, { cols: number; rows: number }>;
  ptyDimensions: { cols: number; rows: number };
}

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
