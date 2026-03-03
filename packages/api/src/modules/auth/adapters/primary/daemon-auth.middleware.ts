import { Effect, Logger } from 'effect';
import { createMiddleware } from 'hono/factory';
import { auth } from '#modules/auth/auth-instance';

const loggerLayer = Logger.layer([Logger.consolePretty()]);

const log = (effect: Effect.Effect<void>) => Effect.runSync(Effect.provide(effect, loggerLayer));

const CACHE_TTL_MS = 5 * 60 * 1000;

const verifiedKeys = new Map<string, { userId: string; expiresAt: number }>();

function getCachedUserId(token: string): string | null {
  const entry = verifiedKeys.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    verifiedKeys.delete(token);
    return null;
  }
  return entry.userId;
}

export type DaemonAuthEnv = {
  Variables: {
    daemonUserId: string;
  };
};

export const daemonAuthMiddleware = createMiddleware<DaemonAuthEnv>(async (c, next) => {
  const token = c.req.query('token');

  if (!token) {
    log(Effect.logWarning('[daemon-auth] Missing token query parameter'));
    return c.json({ error: 'Missing token query parameter' }, 401);
  }

  const cachedUserId = getCachedUserId(token);
  if (cachedUserId) {
    c.set('daemonUserId', cachedUserId);
    await next();
    return;
  }

  try {
    const result = await auth.api.verifyApiKey({
      body: { key: token },
    });

    if (!result.valid || !result.key) {
      log(
        Effect.annotateLogs(Effect.logWarning('[daemon-auth] Invalid API key'), {
          error: result.error ?? 'unknown',
          tokenPrefix: token.slice(0, 12),
        })
      );
      return c.json({ error: 'Invalid API key' }, 401);
    }

    verifiedKeys.set(token, {
      userId: result.key.referenceId,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    c.set('daemonUserId', result.key.referenceId);
  } catch (err) {
    const isRateLimited =
      err instanceof Error &&
      'body' in err &&
      (err as { body?: { code?: string } }).body?.code === 'RATE_LIMITED';
    if (isRateLimited) {
      const retryMs = (err as { body?: { details?: { tryAgainIn?: number } } }).body?.details
        ?.tryAgainIn;
      const retrySeconds = retryMs ? Math.ceil(retryMs / 1000) : 60;
      log(
        Effect.annotateLogs(Effect.logWarning('[daemon-auth] Rate limited by Better Auth'), {
          retryInSeconds: retrySeconds,
          tokenPrefix: token.slice(0, 12),
        })
      );
      return c.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(retrySeconds) } }
      );
    }
    log(
      Effect.annotateLogs(Effect.logError('[daemon-auth] Error verifying API key'), {
        error: String(err),
      })
    );
    return c.json({ error: 'Authentication failed' }, 401);
  }

  await next();
});

export function clearApiKeyCache(): void {
  verifiedKeys.clear();
}
