import { UpstreamMessageSchema } from '@tmonier/shared';
import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import * as v from 'valibot';
import { registerDaemon } from '../../commands/register-daemon.command.js';
import { unregisterDaemon } from '../../commands/unregister-daemon.command.js';
import type { DaemonSession } from '../../domain/daemon-session.js';
import { EventPublisher } from '../../ports/event-publisher.port.js';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository.js';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository.js';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher.js';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive
);

const daemonWsApp = new Hono();

const sessionByWs = new WeakMap<object, DaemonSession>();

daemonWsApp.get(
  '/ws/daemon',
  upgradeWebSocket(() => ({
    onMessage: async (event, ws) => {
      const raw = ws.raw;
      if (!raw) return;

      const data = typeof event.data === 'string' ? event.data : String(event.data);
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        return;
      }

      const result = v.safeParse(UpstreamMessageSchema, parsed);
      if (!result.success) return;

      const msg = result.output;

      switch (msg.type) {
        case 'daemon:hello': {
          const session = await Effect.runPromise(
            Effect.provide(registerDaemon(msg, raw as unknown as WebSocket), allLayers)
          );
          sessionByWs.set(raw, session);
          break;
        }
        case 'command:output':
        case 'command:done':
        case 'command:error': {
          const session = sessionByWs.get(raw);
          if (session) {
            await Effect.runPromise(
              Effect.provide(
                Effect.gen(function* () {
                  const publisher = yield* Effect.service(EventPublisher);
                  yield* publisher.publish(session.id, msg);
                }),
                allLayers
              )
            );
          }
          break;
        }
        case 'pong':
          break;
      }
    },
    onClose: async (_event, ws) => {
      const raw = ws.raw;
      if (!raw) return;
      const session = sessionByWs.get(raw);
      if (session) {
        await Effect.runPromise(Effect.provide(unregisterDaemon(session.id), allLayers)).catch(
          () => {}
        );
        sessionByWs.delete(raw);
      }
    },
  }))
);

export { daemonWsApp, websocket };
