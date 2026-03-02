import { UpstreamMessageSchema } from '@tmonier/shared';
import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import * as v from 'valibot';
import {
  type DaemonAuthEnv,
  daemonAuthMiddleware,
} from '#modules/auth/adapters/primary/daemon-auth.middleware';
import { registerDaemon } from '#modules/supervision/commands/register-daemon.command';
import { unregisterDaemon } from '#modules/supervision/commands/unregister-daemon.command';
import type { DaemonSession } from '#modules/supervision/domain/daemon-session';
import { EventPublisher } from '#modules/supervision/ports/event-publisher.port';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive
);

const daemonWsApp = new Hono<DaemonAuthEnv>();

const sessionByWs = new WeakMap<object, DaemonSession>();

daemonWsApp.get(
  '/ws/daemon',
  daemonAuthMiddleware,
  upgradeWebSocket((c) => {
    const userId = (c as unknown as { get(key: 'daemonUserId'): string }).get('daemonUserId');

    return {
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
              Effect.provide(registerDaemon(msg, raw as unknown as WebSocket, userId), allLayers)
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
    };
  })
);

export { daemonWsApp, websocket };
