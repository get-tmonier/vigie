import { type Effect, ServiceMap } from 'effect';

interface TerminalRelayShape {
  readonly create: (sessionId: string) => Effect.Effect<void>;
  readonly write: (sessionId: string, data: string) => Effect.Effect<void>;
  readonly batchWrite: (sessionId: string, data: string) => Effect.Effect<void>;
  readonly subscribe: (
    sessionId: string,
    onData: (data: string) => void
  ) => Effect.Effect<() => void>;
  readonly destroy: (sessionId: string) => Effect.Effect<void>;
}

export class TerminalRelay extends ServiceMap.Service<TerminalRelay, TerminalRelayShape>()(
  'TerminalRelay'
) {}
