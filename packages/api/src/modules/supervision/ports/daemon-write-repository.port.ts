import { type Effect, ServiceMap } from 'effect';
import type { DaemonSession } from '../domain/daemon-session';
import type { DaemonNotFoundError } from './errors';

interface DaemonWriteRepositoryShape {
  readonly register: (session: DaemonSession, ws: WebSocket) => Effect.Effect<DaemonSession>;
  readonly unregister: (id: string) => Effect.Effect<void>;
  readonly getWs: (id: string) => Effect.Effect<WebSocket, DaemonNotFoundError>;
}

export class DaemonWriteRepository extends ServiceMap.Service<
  DaemonWriteRepository,
  DaemonWriteRepositoryShape
>()('DaemonWriteRepository') {}
