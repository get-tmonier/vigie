import type { Effect } from 'effect';
import type { DaemonToSession, SessionToDaemon } from '#shared/kernel/contracts/ipc-protocol';
import type { IpcConnectionError } from '#shell/domain/errors';

export type { IpcConnectionError } from '#shell/domain/errors';

export interface IpcClientShape {
  readonly connect: (socketPath: string) => Effect.Effect<void, IpcConnectionError>;
  readonly send: (msg: SessionToDaemon) => Effect.Effect<void, IpcConnectionError>;
  readonly waitForMessage: <T extends DaemonToSession['type']>(
    type: T
  ) => Effect.Effect<Extract<DaemonToSession, { type: T }>, IpcConnectionError>;
  readonly onMessage: (handler: (msg: DaemonToSession) => void) => void;
  readonly onClose: (handler: () => void) => void;
  readonly close: () => Effect.Effect<void>;
}
