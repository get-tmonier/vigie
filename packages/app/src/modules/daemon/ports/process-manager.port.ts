import type { Effect } from 'effect';
import type { DaemonInfo } from '../domain/daemon-info';
import type {
  DaemonAlreadyRunningError,
  DaemonNotRunningError,
  DaemonStartError,
} from '../domain/errors';

export interface ProcessManagerShape {
  readonly start: () => Effect.Effect<DaemonInfo, DaemonAlreadyRunningError | DaemonStartError>;
  readonly stop: () => Effect.Effect<void, DaemonNotRunningError>;
  readonly status: () => Effect.Effect<DaemonInfo, DaemonNotRunningError>;
  readonly isRunning: () => Effect.Effect<boolean>;
}
