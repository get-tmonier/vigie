import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { executeCommand } from '../../commands/execute-command.command.js';
import { listDaemons } from '../../queries/list-daemons.query.js';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository.js';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository.js';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher.js';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive
);

const daemonRestApp = new Hono();

daemonRestApp.get('/daemons', async (c) => {
  const daemons = await Effect.runPromise(Effect.provide(listDaemons(), allLayers));
  return c.json({ daemons });
});

daemonRestApp.post('/daemons/:daemonId/exec', async (c) => {
  const daemonId = c.req.param('daemonId');
  const body = await c.req.json<{ command: string; cwd?: string }>();

  const result = await Effect.runPromise(
    Effect.provide(
      Effect.matchEffect(executeCommand(daemonId, body.command, body.cwd), {
        onSuccess: (result) => Effect.succeed({ ok: true as const, commandId: result.commandId }),
        onFailure: (e) =>
          Effect.succeed({ ok: false as const, error: `Daemon not found: ${e.id}` }),
      }),
      allLayers
    )
  );

  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({ commandId: result.commandId });
});

export { daemonRestApp };
