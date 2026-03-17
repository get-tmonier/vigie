import type { AgentSession } from '#modules/supervision/domain/agent-session';
import type { DaemonSession } from '#modules/supervision/domain/daemon-session';

interface DaemonEntry {
  readonly session: DaemonSession;
  readonly ws: WebSocket;
  lastPongAt: number;
}

interface InputHistoryEntry {
  readonly text: string;
  readonly source: 'cli' | 'browser';
  readonly timestamp: number;
}

export const daemonStore = new Map<string, DaemonEntry>();
export const sessionStore = new Map<string, AgentSession>();
export const sessionToDaemon = new Map<string, string>();
export const inputHistoryStore = new Map<string, InputHistoryEntry[]>();
// Maps sessionId → set of send functions for each connected browser WS — used to push control messages (e.g. pty-resized)
export const browserControlSenders = new Map<string, Set<(msg: string) => void>>();
