import type { PtyHandle } from '#modules/agent-session/application/ports/out/pty-spawner.port';

export interface PtyEntry {
  handle: PtyHandle;
  cliChannels: Map<string, { cols: number; rows: number }>;
  browserChannels: Map<string, { cols: number; rows: number }>;
  ptyDimensions: { cols: number; rows: number };
}

export interface PtyRegistry {
  ptyHandles: Map<string, PtyEntry>;
  sessionConnections: Map<string, string>; // sessionId → connId
  connSessions: Map<string, string>; // connId → sessionId
}

export function createPtyRegistry(): PtyRegistry {
  return {
    ptyHandles: new Map(),
    sessionConnections: new Map(),
    connSessions: new Map(),
  };
}
