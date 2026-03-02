import type { DaemonSession } from '#modules/supervision/domain/daemon-session';

interface DaemonEntry {
  readonly session: DaemonSession;
  readonly ws: WebSocket;
}

export const daemonStore = new Map<string, DaemonEntry>();
