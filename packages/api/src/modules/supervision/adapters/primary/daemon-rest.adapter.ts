import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import type { AuthEnv } from '#modules/auth/adapters/primary/session-middleware';
import { executeCommand } from '#modules/supervision/commands/execute-command.command';
import { DaemonReadRepository } from '#modules/supervision/ports/daemon-read-repository.port';
import { listDaemons } from '#modules/supervision/queries/list-daemons.query';
import { SupervisionLoggerLive } from '../logger';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive,
  SupervisionLoggerLive
);

const daemonRestApp = new Hono<AuthEnv>();

daemonRestApp.get('/daemons', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemons = await Effect.runPromise(Effect.provide(listDaemons(), allLayers));
  return c.json({ daemons: daemons.filter((d) => d.userId === user.id) });
});

daemonRestApp.post('/daemons/:daemonId/exec', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const daemonId = c.req.param('daemonId');
  const body = await c.req.json<{ command: string; cwd?: string }>();

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

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(executeCommand(daemonId, body.command, body.cwd), {
        onSuccess: (r) => Effect.succeed({ ok: true as const, commandId: r.commandId }),
        onFailure: (e) =>
          Effect.succeed({ ok: false as const, error: `Daemon not found: ${e.id}` }),
      }),
      allLayers
    )
  );

  if (!result.ok) {
    await Effect.runPromise(
      Effect.provide(
        Effect.annotateLogs(Effect.logWarning('Command dispatch failed'), { daemonId }),
        allLayers
      )
    );
    return c.json({ error: result.error }, 404);
  }

  await Effect.runPromise(
    Effect.provide(
      Effect.annotateLogs(Effect.logInfo('Command dispatched'), {
        daemonId,
        commandId: result.commandId,
        command: body.command,
      }),
      allLayers
    )
  );

  return c.json({ commandId: result.commandId });
});

export { daemonRestApp };
