import type { Effect } from 'effect';
import type { SessionToDaemon } from '#schemas/ipc-messages.js';

export interface IpcConnection {
  readonly id: string;
  readonly send: (data: string) => void;
  readonly close: () => void;
}

export interface IpcServerShape {
  readonly start: (
    socketPath: string,
    onMessage: (conn: IpcConnection, msg: SessionToDaemon) => Effect.Effect<void>,
    onDisconnect: (connId: string) => Effect.Effect<void>
  ) => Effect.Effect<void>;
  readonly sendTo: (connId: string, data: string) => Effect.Effect<void>;
  readonly shutdown: () => Effect.Effect<void>;
}
