import { Effect, Layer } from 'effect';
import { TerminalRelay } from '#modules/supervision/ports/terminal-relay.port';

const subscribers = new Map<string, Set<(data: string) => void>>();

export const InMemoryTerminalRelayLive = Layer.succeed(TerminalRelay, {
  publishOutput: (sessionId, data) =>
    Effect.gen(function* () {
      const subs = subscribers.get(sessionId);
      if (subs) {
        for (const cb of subs) {
          cb(data);
        }
      }
      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: publishing output'), {
        sessionId,
        subscriberCount: subs?.size ?? 0,
      });
    }),
  subscribeOutput: (sessionId, callback) =>
    Effect.gen(function* () {
      let subs = subscribers.get(sessionId);
      if (!subs) {
        subs = new Set();
        subscribers.set(sessionId, subs);
      }
      subs.add(callback);
      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: subscriber added'), {
        sessionId,
        subscriberCount: subs.size,
      });
      return () => {
        subs.delete(callback);
        if (subs.size === 0) {
          subscribers.delete(sessionId);
        }
      };
    }),
});
