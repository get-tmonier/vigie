import { Effect, Layer } from 'effect';
import { TerminalRelay } from '#modules/supervision/ports/terminal-relay.port';

interface RelayEntry {
  readonly subscribers: Set<(data: string) => void>;
  readonly buffer: string[];
}

const MAX_BUFFER_SIZE = 500;

const relays = new Map<string, RelayEntry>();

export const InMemoryTerminalRelayLive = Layer.succeed(TerminalRelay, {
  create: (sessionId) =>
    Effect.gen(function* () {
      const existing = relays.get(sessionId);
      if (existing) {
        // Preserve subscribers (e.g. active terminal WS connections) — only
        // clear the buffer so sync can repopulate it with fresh chunks.
        existing.buffer.length = 0;
      } else {
        relays.set(sessionId, {
          subscribers: new Set(),
          buffer: [],
        });
      }
      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: created'), { sessionId });
    }),

  write: (sessionId, data) =>
    Effect.sync(() => {
      const entry = relays.get(sessionId);
      if (!entry) return;

      // Always buffer so replay works after reconnect/navigation
      entry.buffer.push(data);
      if (entry.buffer.length > MAX_BUFFER_SIZE) {
        entry.buffer.shift();
      }

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

      // Replay buffered data to the new subscriber
      for (const chunk of entry.buffer) {
        onData(chunk);
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

  batchWrite: (sessionId, data) =>
    Effect.sync(() => {
      const entry = relays.get(sessionId);
      if (!entry) return;
      entry.buffer.push(data);
      if (entry.buffer.length > MAX_BUFFER_SIZE) {
        entry.buffer.shift();
      }
      // No subscriber broadcast — history only
    }),

  destroy: (sessionId) =>
    Effect.gen(function* () {
      const entry = relays.get(sessionId);
      if (!entry) return;

      entry.subscribers.clear();
      entry.buffer.length = 0;
      relays.delete(sessionId);

      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: destroyed'), { sessionId });
    }),
});
