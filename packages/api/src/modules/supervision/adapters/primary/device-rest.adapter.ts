import { Effect, Layer } from 'effect';
import { Hono } from 'hono';
import { requireAuth } from '#modules/auth/adapters/primary/require-auth.middleware';
import { type AuthEnv, sessionMiddleware } from '#modules/auth/adapters/primary/session-middleware';
import { auth } from '#modules/auth/auth-instance';
import { listDaemons } from '#modules/supervision/queries/list-daemons.query';
import { InMemoryDaemonReadRepositoryLive } from '../secondary/in-memory-daemon-read-repository';
import { InMemoryDaemonWriteRepositoryLive } from '../secondary/in-memory-daemon-write-repository';
import { InMemoryEventPublisherLive } from '../secondary/in-memory-event-publisher';

const allLayers = Layer.mergeAll(
  InMemoryDaemonWriteRepositoryLive,
  InMemoryDaemonReadRepositoryLive,
  InMemoryEventPublisherLive
);

const CLI_NAME_PATTERN = /^CLI \((.+)\)$/;

export const deviceRestApp = new Hono<AuthEnv>();

deviceRestApp.use('*', sessionMiddleware, requireAuth);

deviceRestApp.get('/devices', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const [keysResponse, allDaemons] = await Promise.all([
    auth.api.listApiKeys({ headers: c.req.raw.headers }),
    Effect.runPromise(Effect.provide(listDaemons(), allLayers)),
  ]);

  const userDaemons = allDaemons.filter((d) => d.userId === user.id);

  const devices = keysResponse.apiKeys
    .filter((key) => key.name && CLI_NAME_PATTERN.test(key.name))
    .map((key) => {
      const hostname = CLI_NAME_PATTERN.exec(key.name as string)?.[1] ?? 'unknown';
      const daemon = userDaemons.find((d) => d.hostname === hostname);
      return {
        id: key.id,
        name: key.name,
        hostname,
        createdAt: key.createdAt,
        status: daemon ? ('online' as const) : ('offline' as const),
        daemonId: daemon?.id ?? null,
        version: daemon?.version ?? null,
        connectedAt: daemon?.connectedAt ?? null,
      };
    });

  return c.json({ devices });
});
