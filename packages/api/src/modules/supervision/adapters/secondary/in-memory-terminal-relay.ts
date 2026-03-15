import { Effect, Layer } from 'effect';
import { TerminalRelay } from '#modules/supervision/ports/terminal-relay.port';

interface RelayEntry {
  readonly subscribers: Set<(data: string) => void>;
}

const relays = new Map<string, RelayEntry>();

export const InMemoryTerminalRelayLive = Layer.succeed(TerminalRelay, {
  create: (sessionId) =>
    Effect.gen(function* () {
      const existing = relays.get(sessionId);
      if (existing) {
        existing.subscribers.clear();
      }
      relays.set(sessionId, {
        subscribers: new Set(),
      });
      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: created'), { sessionId });
    }),

  write: (sessionId, data) =>
    Effect.sync(() => {
      const entry = relays.get(sessionId);
      if (!entry) return;

      for (const cb of entry.subscribers) {
        cb(data);
      }
    }),

  subscribe: (sessionId, onData) =>
    Effect.gen(function* () {
      const entry = relays.get(sessionId);
      if (!entry) {
        return () => {};
      }

      entry.subscribers.add(onData);

      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: subscriber added'), {
        sessionId,
        subscriberCount: String(entry.subscribers.size),
      });

      return () => {
        entry.subscribers.delete(onData);
      };
    }),

  clearBuffer: (_sessionId) => Effect.void,

  destroy: (sessionId) =>
    Effect.gen(function* () {
      const entry = relays.get(sessionId);
      if (!entry) return;

      entry.subscribers.clear();
      relays.delete(sessionId);

      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: destroyed'), { sessionId });
    }),
});
