import type { Effect } from 'effect';

export interface BackendClientShape {
  readonly connect: (url: string, token: string) => Effect.Effect<void>;
  readonly send: (msg: unknown) => Effect.Effect<void>;
  readonly onMessage: (handler: (data: string) => void) => void;
  readonly close: () => Effect.Effect<void>;
}
