import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { subscribeToEvents } from '#modules/supervision/queries/subscribe-events.query';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';

const allLayers = Layer.mergeAll(InMemoryDaemonReadRepositoryLive, InMemoryEventPublisherLive);

const daemonSseApp = new Hono();

daemonSseApp.get('/daemons/:daemonId/events', (c) => {
  const daemonId = c.req.param('daemonId');

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
