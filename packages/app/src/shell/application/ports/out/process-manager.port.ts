// Controls the vigie daemon process lifecycle (start, stop, status).
// Used by CLI commands (`vigie daemon start/stop/status`) — not by the daemon itself.
import type { Effect } from 'effect';
import type { DaemonInfo } from '#shell/domain/daemon-info';
import type {
  DaemonAlreadyRunningError,
  DaemonNotRunningError,
  DaemonStartError,
} from '#shell/domain/errors';

export interface ProcessManagerShape {
  readonly start: () => Effect.Effect<DaemonInfo, DaemonAlreadyRunningError | DaemonStartError>;
  readonly stop: () => Effect.Effect<void, DaemonNotRunningError>;
  readonly status: () => Effect.Effect<DaemonInfo, DaemonNotRunningError>;
  readonly isRunning: () => Effect.Effect<boolean>;
}
