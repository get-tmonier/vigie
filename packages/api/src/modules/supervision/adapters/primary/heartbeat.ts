import { Effect, Layer } from 'effect';
import { unregisterDaemon } from '#modules/supervision/commands/unregister-daemon.command';
import { SupervisionLoggerLive } from '../logger';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';
import { daemonStore } from '../secondary/shared-state';

const PING_INTERVAL_MS = 15_000;
const STALE_THRESHOLD_MS = 45_000;

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive,
  SupervisionLoggerLive
);

export function startHeartbeat(): () => void {
  const id = setInterval(() => {
    const now = Date.now();
    for (const [daemonId, entry] of daemonStore) {
      if (now - entry.lastPongAt > STALE_THRESHOLD_MS) {
        Effect.runPromise(
          Effect.provide(
            Effect.gen(function* () {
              yield* unregisterDaemon(daemonId);
              yield* Effect.annotateLogs(Effect.logInfo('Heartbeat timeout — daemon reaped'), {
                daemonId,
              });
            }),
            allLayers
          )
        ).catch(() => {});
        entry.ws.close(4000, 'heartbeat timeout');
      } else if (entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }
  }, PING_INTERVAL_MS);

  return () => clearInterval(id);
}
