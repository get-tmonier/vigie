import type { DaemonHello } from '@tmonier/shared';

export interface DaemonSession {
  readonly id: string;
  readonly userId: string;
  readonly hostname: string;
  readonly pid: number;
  readonly version: string;
  readonly connectedAt: number;
}

export const createDaemonSession = (hello: DaemonHello, userId: string): DaemonSession => ({
  id: crypto.randomUUID(),
  userId,
  hostname: hello.hostname,
  pid: hello.pid,
  version: hello.version,
  connectedAt: Date.now(),
});
