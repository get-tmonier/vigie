import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AuthEnv } from '#modules/auth/adapters/primary/session-middleware';
import { DaemonReadRepository } from '#modules/supervision/ports/daemon-read-repository.port';
import { subscribeToEvents } from '#modules/supervision/queries/subscribe-events.query';
import { SupervisionLoggerLive } from '../logger';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';
import { inputHistoryStore, sessionStore } from '../secondary/shared-state';

const allLayers = Layer.mergeAll(
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive,
  SupervisionLoggerLive
);

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
    await Effect.runPromise(
      Effect.provide(
        Effect.annotateLogs(Effect.logWarning('SSE: daemon not found'), { daemonId }),
        allLayers
      )
    );
    return c.json({ error: `Daemon not found: ${daemonId}` }, 404);
  }

  return streamSSE(c, async (stream) => {
    await Effect.runPromise(
      Effect.provide(
        Effect.annotateLogs(Effect.logInfo('SSE: client subscribed'), {
          daemonId,
          userId: user.id,
        }),
        allLayers
      )
    );

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

    // Emit current state snapshot so a new SSE client (page refresh, reconnect)
    // immediately sees existing sessions without waiting for a daemon
    // disconnect/reconnect cycle.
    for (const session of sessionStore.values()) {
      if (session.daemonId !== daemonId) continue;
      stream
        .writeSSE({
          event: 'session:started',
          data: JSON.stringify({
            type: 'session:started',
            daemonId: session.daemonId,
            sessionId: session.id,
            agentType: session.agentType,
            mode: session.mode,
            cwd: session.cwd,
            ...(session.gitBranch !== undefined && { gitBranch: session.gitBranch }),
            ...(session.repoName !== undefined && { repoName: session.repoName }),
            ...(session.resumable !== undefined && { resumable: session.resumable }),
            ...(session.claudeSessionId !== undefined && {
              claudeSessionId: session.claudeSessionId,
            }),
            timestamp: session.startedAt,
          }),
        })
        .catch(() => {});
      if (session.status === 'ended') {
        stream
          .writeSSE({
            event: 'session:ended',
            data: JSON.stringify({
              type: 'session:ended',
              daemonId: session.daemonId,
              sessionId: session.id,
              exitCode: session.exitCode ?? 0,
              resumable: session.resumable ?? false,
              timestamp: Date.now(),
            }),
          })
          .catch(() => {});
      }
      const history = inputHistoryStore.get(session.id);
      if (history) {
        for (const entry of history) {
          stream
            .writeSSE({
              event: 'terminal:input-echo',
              data: JSON.stringify({
                type: 'terminal:input-echo',
                daemonId,
                sessionId: session.id,
                text: entry.text,
                source: entry.source,
                timestamp: entry.timestamp,
              }),
            })
            .catch(() => {});
        }
      }
    }

    stream.writeSSE({ event: 'keepalive', data: '' }).catch(() => {});
    const keepalive = setInterval(() => {
      stream.writeSSE({ event: 'keepalive', data: '' }).catch(() => {});
    }, 10_000);

    stream.onAbort(async () => {
      clearInterval(keepalive);
      unsubscribe();
      await Effect.runPromise(
        Effect.provide(
          Effect.annotateLogs(Effect.logInfo('SSE: client disconnected'), { daemonId }),
          allLayers
        )
      );
    });

    await new Promise<void>((resolve) => {
      stream.onAbort(resolve);
    });
  });
});

export { daemonSseApp };
