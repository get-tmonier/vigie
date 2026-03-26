import type { Effect } from 'effect';
import type { DaemonToSession, SessionToDaemon } from '#schemas/ipc-messages.js';
import type { IpcConnectionError } from '../domain/errors.js';

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
