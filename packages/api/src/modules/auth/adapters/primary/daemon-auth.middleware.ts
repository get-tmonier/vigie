import { createMiddleware } from 'hono/factory';
import { auth } from '#modules/auth/auth-instance';

export type DaemonAuthEnv = {
  Variables: {
    daemonUserId: string;
  };
};

export const daemonAuthMiddleware = createMiddleware<DaemonAuthEnv>(async (c, next) => {
  const token = c.req.query('token');

  if (!token) {
    console.error('[daemon-auth] Missing token query parameter');
    return c.json({ error: 'Missing token query parameter' }, 401);
  }

  try {
    const result = await auth.api.verifyApiKey({
      body: { key: token },
    });

    if (!result.valid || !result.key) {
      console.error('[daemon-auth] Invalid API key');
      return c.json({ error: 'Invalid API key' }, 401);
    }

    c.set('daemonUserId', result.key.referenceId);
  } catch (err) {
    console.error('[daemon-auth] Error verifying API key:', err);
    return c.json({ error: 'Authentication failed' }, 401);
  }

  await next();
});
