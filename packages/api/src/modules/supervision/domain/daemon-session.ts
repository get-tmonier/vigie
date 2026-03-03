import { createHash } from 'node:crypto';
import type { DaemonHello } from '@tmonier/shared';

export interface DaemonSession {
  readonly id: string;
  readonly userId: string;
  readonly hostname: string;
  readonly pid: number;
  readonly version: string;
  readonly connectedAt: number;
}

export const deriveDaemonId = (userId: string, hostname: string): string =>
  createHash('sha256').update(`${userId}:${hostname}`).digest('hex').slice(0, 32);

export const createDaemonSession = (
  daemonId: string,
  hello: DaemonHello,
  userId: string
): DaemonSession => ({
  id: daemonId,
  userId,
  hostname: hello.hostname,
  pid: hello.pid,
  version: hello.version,
  connectedAt: Date.now(),
});
