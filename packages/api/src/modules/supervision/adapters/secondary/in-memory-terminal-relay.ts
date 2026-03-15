import { Effect, Layer } from 'effect';
import { TerminalRelay } from '#modules/supervision/ports/terminal-relay.port';

const subscribers = new Map<string, Set<(data: string) => void>>();
const buffers = new Map<string, string[]>();

const MAX_BUFFER_CHUNKS = 10000;

export const InMemoryTerminalRelayLive = Layer.succeed(TerminalRelay, {
  publishOutput: (sessionId, data) =>
    Effect.gen(function* () {
      let buf = buffers.get(sessionId);
      if (!buf) {
        buf = [];
        buffers.set(sessionId, buf);
      }
      buf.push(data);
      if (buf.length > MAX_BUFFER_CHUNKS) {
        buf.splice(0, buf.length - MAX_BUFFER_CHUNKS);
      }

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
      const buf = buffers.get(sessionId);
      if (buf) {
        for (const chunk of buf) {
          callback(chunk);
        }
      }

      let subs = subscribers.get(sessionId);
      if (!subs) {
        subs = new Set();
        subscribers.set(sessionId, subs);
      }
      subs.add(callback);
      yield* Effect.annotateLogs(Effect.logDebug('TerminalRelay: subscriber added'), {
        sessionId,
        subscriberCount: subs.size,
        replayedChunks: buf?.length ?? 0,
      });
      return () => {
        subs.delete(callback);
        if (subs.size === 0) {
          subscribers.delete(sessionId);
        }
      };
    }),
});
