import { type Effect, ServiceMap } from 'effect';

interface TerminalRelayShape {
  readonly publishOutput: (sessionId: string, data: string) => Effect.Effect<void>;
  readonly subscribeOutput: (
    sessionId: string,
    cb: (data: string) => void
  ) => Effect.Effect<() => void>;
}

export class TerminalRelay extends ServiceMap.Service<TerminalRelay, TerminalRelayShape>()(
  'TerminalRelay'
) {}
