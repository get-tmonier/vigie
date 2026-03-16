import type { AgentSession } from '#modules/supervision/domain/agent-session';
import type { DaemonSession } from '#modules/supervision/domain/daemon-session';

interface DaemonEntry {
  readonly session: DaemonSession;
  readonly ws: WebSocket;
  lastPongAt: number;
}

export const daemonStore = new Map<string, DaemonEntry>();
export const sessionStore = new Map<string, AgentSession>();
export const sessionToDaemon = new Map<string, string>();
