import { type Effect, ServiceMap } from 'effect';
import type { DaemonSession } from '../domain/daemon-session';
import type { DaemonNotFoundError } from './errors';

interface DaemonReadRepositoryShape {
  readonly get: (id: string) => Effect.Effect<DaemonSession, DaemonNotFoundError>;
  readonly list: () => Effect.Effect<ReadonlyArray<DaemonSession>>;
}

export class DaemonReadRepository extends ServiceMap.Service<
  DaemonReadRepository,
  DaemonReadRepositoryShape
>()('DaemonReadRepository') {}
