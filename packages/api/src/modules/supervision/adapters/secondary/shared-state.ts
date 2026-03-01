import type { DaemonSession } from '../../domain/daemon-session.js';

interface DaemonEntry {
  readonly session: DaemonSession;
  readonly ws: WebSocket;
}

export const daemonStore = new Map<string, DaemonEntry>();
