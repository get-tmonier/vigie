import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AuthEnv } from '#modules/auth/adapters/primary/session-middleware';
import { DaemonReadRepository } from '#modules/supervision/ports/daemon-read-repository.port';
import { subscribeToEvents } from '#modules/supervision/queries/subscribe-events.query';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';

const allLayers = Layer.mergeAll(InMemoryDaemonReadRepositoryLive, InMemoryEventPublisherLive);

const daemonSseApp = new Hono<AuthEnv>();

daemonSseApp.get('/daemons/:daemonId/events', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');

  const daemon = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(
        Effect.service(DaemonReadRepository).pipe(Effect.flatMap((r) => r.get(daemonId))),
        {
          onSuccess: (d) => Effect.succeed(d),
          onFailure: () => Effect.succeed(null),
        }
      ),
      allLayers
    )
  );
  if (!daemon || daemon.userId !== user.id) {
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  return streamSSE(c, async (stream) => {
    const unsubscribe = await Effect.runPromise(
      Effect.provide(
        subscribeToEvents(daemonId, (event) => {
          stream
            .writeSSE({
              event: event.type,
              data: JSON.stringify(event),
            })
            .catch(() => {});
        }),
        allLayers
      )
    );

    stream.onAbort(() => {
      unsubscribe();
    });

    await new Promise<void>((resolve) => {
      stream.onAbort(resolve);
    });
  });
});

export { daemonSseApp };
